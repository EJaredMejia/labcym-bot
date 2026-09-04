import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import qrcode from "qrcode-terminal";
import { processUserMessage } from "./whatsapp.service";
import { useRedisAuthState } from "../redis/redis-auth.service";
import { pauseChat, resumeChat } from "../redis/session.service";

let socket: WASocket | null = null;

export function getBaileysSocket(): WASocket {
  if (!socket) {
    throw new Error(
      "Baileys socket has not been initialized. Please ensure initBaileys() has completed before accessing the socket.",
    );
  }
  return socket;
}

export async function initBaileys() {
  const { state, saveCreds } = await useRedisAuthState("labcym_bot");
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(
    `Using Baileys version ${version.join(".")}, isLatest: ${isLatest}`,
  );

  socket = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    auth: state,
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    shouldIgnoreJid: (jid) =>
      jid.endsWith("@broadcast") ||
      jid.endsWith("@newsletter") ||
      jid.endsWith("@g.us"),
  });

  if (!socket) {
    throw new Error(
      "Baileys socket has not been initialized. Please ensure initBaileys() has completed before accessing the socket.",
    );
  }

  const sock = socket;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n📱 Scan this QR code with WhatsApp on your phone:\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;

      if (shouldReconnect) {
        console.log("Connection closed. Reconnecting in 3s...");
        setTimeout(() => initBaileys(), 3000);
      } else {
        console.log(
          "Logged out from WhatsApp. Clear auth folder and restart to re-scan.",
        );
      }
    } else if (connection === "open") {
      console.log("✅ Successfully connected to WhatsApp via Baileys!");
    }
  });

  sock.ev.on("messages.upsert", async (m) => {
    if (m.type !== "notify") return;

    const isDev = process.env.NODE_ENV !== "production";

    for (const msg of m.messages) {
      if (!msg.message || msg.key.remoteJid === "status@broadcast") {
        continue;
      }

      const remoteJid = msg.key.remoteJid;
      if (!remoteJid) continue;

      // Ignore group messages (keep it 1-to-1)
      if (remoteJid.endsWith("@g.us")) {
        continue;
      }

      const botNumber = sock.user?.id
        ? sock.user.id.split(":")[0].replace(/\D/g, "")
        : null;
      const botLid = sock.user?.lid
        ? sock.user.lid.split(":")[0].replace(/\D/g, "")
        : null;

      // Extract phone / user identifier
      // When messaging from @lid or multi-device, remoteJid contains an internal LID (e.g. 224158789181491@lid).
      // 1. Check if msg.key has remoteJidAlt / participantAlt / participant
      // 2. Query Baileys internal signalRepository LID-to-PN mapping store
      // 3. Fallback to botNumber for self-chats or stripped remoteJid
      let rawPhone = remoteJid.replace("@s.whatsapp.net", "").replace("@lid", "").replace(/\D/g, "");

      const isLidSelfChat = Boolean(botLid && remoteJid.includes(botLid));
      const isPhoneSelfChat = Boolean(
        botNumber && (remoteJid.includes(botNumber) || rawPhone === botNumber),
      );
      const isSelfChat = isPhoneSelfChat || isLidSelfChat;

      if (isSelfChat && botNumber) {
        rawPhone = botNumber;
      } else if (remoteJid.endsWith("@lid")) {
        const altJid = (msg.key as any).remoteJidAlt || (msg.key as any).participantAlt || msg.key.participant;
        if (altJid && altJid.includes("@s.whatsapp.net")) {
          rawPhone = altJid.split("@")[0].split(":")[0].replace(/\D/g, "");
        } else {
          try {
            const mappedPn = await sock.signalRepository?.lidMapping?.getPNForLID(remoteJid);
            if (mappedPn) {
              rawPhone = mappedPn.split("@")[0].split(":")[0].replace(/\D/g, "");
            }
          } catch (e) {
            // Ignore LID mapping lookup errors
          }
        }
      }

      const recipientPhone = rawPhone;

      // Whitelist check: If ALLOWED_NUMBERS is set, only allow messages matching listed numbers
      const allowedNumbersEnv = process.env.ALLOWED_NUMBERS;
      if (allowedNumbersEnv) {
        const allowedList = allowedNumbersEnv
          .split(",")
          .map((n) => n.replace(/\D/g, ""))
          .filter(Boolean);

        const isAllowed = allowedList.some((allowed) =>
          recipientPhone.includes(allowed) || (botNumber && botNumber.includes(allowed))
        );

        if (!isAllowed) {
          console.log(`[DEBUG] Ignored message from ${remoteJid} (not in ALLOWED_NUMBERS whitelist)`);
          continue;
        }
      }

      // Extract message text / interactive selection / catalog product details
      const messageContent = msg.message;
      let userText =
        messageContent.conversation ||
        messageContent.extendedTextMessage?.text ||
        messageContent.buttonsResponseMessage?.selectedButtonId ||
        messageContent.templateButtonReplyMessage?.selectedId ||
        messageContent.listResponseMessage?.singleSelectReply?.selectedRowId ||
        "";

      if (!userText && messageContent.imageMessage?.caption) {
        userText = messageContent.imageMessage.caption;
      }

      // Check for Catalog Product inquiries
      const productInfo =
        messageContent.productMessage?.product ||
        messageContent.orderMessage ||
        (messageContent.extendedTextMessage?.contextInfo?.quotedMessage as any)?.productMessage?.product;

      const productTitle =
        productInfo?.title ||
        productInfo?.orderTitle ||
        (productInfo?.productId ? `Producto ID ${productInfo.productId}` : undefined);

      if (productTitle && !userText) {
        userText = `Consulta sobre producto: ${productTitle}`;
      }

      console.log(`[DEBUG] Msg from ${remoteJid}, fromMe=${msg.key.fromMe}, isDev=${isDev}, isSelfChat=${isSelfChat}, productTitle="${productTitle || ''}", text="${userText}"`);

      // If the message is sent by human staff from WhatsApp to an external client (not self-chat)
      if (msg.key.fromMe && !isSelfChat) {
        // If staff types #bot or #menu, reactivate the bot for this user
        if (userText.trim().toLowerCase() === "#bot" || userText.trim().toLowerCase() === "#menu") {
          await resumeChat(recipientPhone);
          console.log(`[STAFF] Bot reactivated for ${recipientPhone} via staff command`);
        } else {
          // Whenever human staff replies to a customer, keep the bot paused for 1 hour
          await pauseChat(recipientPhone, 3600);
          console.log(`[STAFF] Human agent replied to ${recipientPhone}. Extended pause by 1 hour.`);
        }
        continue;
      }

      // In production, ignore all messages sent by self (fromMe).
      // In dev mode, allow self-chat messages so you can test from your own phone.
      if (msg.key.fromMe && (!isDev || !isSelfChat)) {
        console.log(`[DEBUG] Ignored because fromMe is true and not recognized as dev self-chat`);
        continue;
      }

      // Prevent the bot from reacting to its own automated replies in self-chat
      if (
        msg.key.fromMe &&
        (userText.includes("LABCYM") ||
          userText.includes("Horarios de atención") ||
          userText.includes("Requisitos para Exámenes") ||
          userText.includes("Consulta sobre:") ||
          userText.includes("Entrega y Consulta"))
      ) {
        continue;
      }

      console.log(`📩 Processing message from ${remoteJid}: "${userText}"`);

      try {
        await processUserMessage({
          recipientPhone,
          remoteJid,
          userInput: userText || "",
          productTitle,
          ntfyTopic: process.env.NTFY_TOPIC || "",
        });
      } catch (error) {
        console.error(
          `💥 Error processing message for ${recipientPhone}:`,
          error,
        );
      }
    }
  });

  return socket;
}
