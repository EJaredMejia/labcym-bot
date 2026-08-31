import { Elysia, t } from "elysia";
import { envPlugin } from "../env";
import { processUserMessage } from "./whatsapp.service";
import type { WhatsAppMessage, WhatsAppWebhookPayload } from "./whatsapp.types";

function extractUserInput(message?: WhatsAppMessage): string {
  if (!message) return "";

  if (message.type === "text") {
    return message.text?.body ?? "";
  }

  if (message.type === "interactive") {
    return (
      message.interactive?.button_reply?.id ??
      message.interactive?.button_reply?.title ??
      message.interactive?.list_reply?.id ??
      message.interactive?.list_reply?.title ??
      ""
    );
  }

  if (message.type === "button") {
    return message.button?.payload ?? message.button?.text ?? "";
  }

  return "";
}

export const whatsappRouter = new Elysia({ prefix: "/whatsapp" })
  .use(envPlugin)
  .onError(({ code, error, set }) => {
    console.error(`🚨 [WhatsApp Router Error] [${code}]:`, error);
    set.status = 500;
    return {
      status: "ERROR",
      message: error instanceof Error ? error.message : "Internal Server Error",
    };
  })
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

    const entry = typeBody?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return { status: "EVENT_RECEIVED" };
    }

    const token = env.WHATSAPP_TOKEN;
    const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token || !phoneNumberId) {
      console.warn("WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID is missing.");
      return { status: "EVENT_RECEIVED" };
    }

    const from = message.from;
    const userInput = extractUserInput(message);

    await processUserMessage({
      token,
      phoneNumberId,
      recipientPhone: from,
      userInput,
      adminPhoneNumber: env.ADMIN_PHONE_NUMBER,
      ntfyTopic: env.NTFY_TOPIC,
    });

    return {
      status: "EVENT_RECEIVED",
    };
  });
