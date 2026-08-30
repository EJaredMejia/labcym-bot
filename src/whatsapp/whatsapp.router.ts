import { Elysia, t } from "elysia";
import { envPlugin } from "../env";
import type { WhatsAppWebhookPayload } from "./whatsapp.types";

export const whatsappRouter = new Elysia({ prefix: "/whatsapp" })
  .use(envPlugin)
  .get(
    "/webhook",
    ({ query, set, env }) => {
      const mode = query["hub.mode"];
      const token = query["hub.verify_token"];
      const challenge = query["hub.challenge"];

      const verifyToken = env.WHATSAPP_VERIFY_TOKEN;

      if (!mode || !token) {
        set.status = 400;
        return "Invalid request";
      }

      if (mode !== "subscribe" || token !== verifyToken) {
        set.status = 403;
        return "Forbidden";
      }

      return challenge;
    },
    {
      query: t.Object({
        "hub.mode": t.String(),
        "hub.verify_token": t.String(),
        "hub.challenge": t.String(),
      }),
    },
  )
  .post("/webhook", async ({ body, env }) => {
    console.log("Incoming Webhook payload:", JSON.stringify(body, null, 2));
    const typeBody = body as WhatsAppWebhookPayload;

    try {
      const entry = typeBody?.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const message = value?.messages?.[0];

      if (!message) {
        return { status: "EVENT_RECEIVED" };
      }

      const from = message.from; // Sender WhatsApp ID / Phone number
      const messageType = message.type; // 'text', 'image', 'audio', 'document', etc.
      const messageId = message.id;

      console.log(`Received message type: ${messageType} from ${from}`);

      const textBody = messageType === "text" ? (message.text?.body ?? "") : "";
      const token = env.WHATSAPP_TOKEN;
      const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;

      if (!token || !phoneNumberId) {
        console.warn(
          "WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID is missing in your environment configuration.",
        );
        return { status: "EVENT_RECEIVED" };
      }

      const responseText = `🤖 Bot received your ${messageType} message${
        textBody ? `: "${textBody}"` : ""
      }! The bot is working properly.`;

      const response = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: from,
            type: "text",
            text: {
              preview_url: false,
              body: responseText,
            },
          }),
        },
      );

      const result = await response.json();
      console.log("WhatsApp API response:", result);
    } catch (error) {
      console.error("Error processing WhatsApp webhook:", error);
    }

    return {
      status: "EVENT_RECEIVED",
    };
  });

