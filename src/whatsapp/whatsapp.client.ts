import { createFetch } from "@better-fetch/fetch";
import type {
  WhatsAppOutgoingPayload,
  WhatsAppSendResponse,
} from "./whatsapp.types";

export const whatsappFetch = createFetch({
  baseURL: "https://graph.facebook.com/v21.0",
  headers: {
    "Content-Type": "application/json",
  },
  throw: true,
});

export interface SendMessageBaseParams {
  token: string;
  phoneNumberId: string;
  to: string;
}

export interface SendWhatsAppMessageParams extends SendMessageBaseParams {
  payload: WhatsAppOutgoingPayload;
}

export interface SendTextMessageParams extends SendMessageBaseParams {
  text: string;
  previewUrl?: boolean;
}

export interface SendButtonMessageParams extends SendMessageBaseParams {
  bodyText: string;
  buttons: Array<{ id: string; title: string }>;
  headerText?: string;
  footerText?: string;
}

export async function sendWhatsAppMessage(
  params: SendWhatsAppMessageParams
): Promise<WhatsAppSendResponse> {
  const { token, phoneNumberId, payload } = params;
  if (!token || !phoneNumberId) {
    throw new Error("Missing WhatsApp token or phoneNumberId");
  }

  const data = await whatsappFetch<WhatsAppSendResponse>(
    `/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: payload,
    }
  );

  return data;
}

export async function sendTextMessage(
  params: SendTextMessageParams
): Promise<WhatsAppSendResponse> {
  const { token, phoneNumberId, to, text, previewUrl = false } = params;
  return sendWhatsAppMessage({
    token,
    phoneNumberId,
    to,
    payload: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: {
        preview_url: previewUrl,
        body: text,
      },
    },
  });
}

export async function sendButtonMessage(
  params: SendButtonMessageParams
): Promise<WhatsAppSendResponse> {
  const { token, phoneNumberId, to, bodyText, buttons, headerText, footerText } =
    params;

  return sendWhatsAppMessage({
    token,
    phoneNumberId,
    to,
    payload: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        ...(headerText ? { header: { type: "text", text: headerText } } : {}),
        body: { text: bodyText },
        ...(footerText ? { footer: { text: footerText } } : {}),
        action: {
          buttons: buttons.slice(0, 3).map((btn) => ({
            type: "reply" as const,
            reply: {
              id: btn.id,
              title: btn.title.slice(0, 20),
            },
          })),
        },
      },
    },
  });
}
