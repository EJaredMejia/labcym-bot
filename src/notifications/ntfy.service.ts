import { createFetch } from "@better-fetch/fetch";

const ntfyFetch = createFetch({
  baseURL: "https://ntfy.sh",
  headers: {
    "Content-Type": "application/json",
  },
  throw: false,
});

export interface SendNtfyAlertParams {
  topic: string;
  clientPhone: string;
  title?: string;
  message?: string;
}

export async function sendNtfyAlert(params: SendNtfyAlertParams): Promise<void> {
  const { topic, clientPhone, title, message } = params;
  if (!topic) return;

  const chatUrl = `https://wa.me/${clientPhone}`;
  const alertTitle = title ?? "Labcym: Solicitud de Atención al cliente";
  const alertBody =
    message ??
    `El cliente +${clientPhone} está solicitando atención personalizada. Toca para abrir WhatsApp.`;

  await ntfyFetch(`/${topic}`, {
    method: "POST",
    headers: {
      Title: alertTitle,
      Priority: "urgent",
      Tags: "rotating_light,whatsapp",
      Click: chatUrl,
      Actions: `view, Abrir Chat WhatsApp, ${chatUrl}`,
    },
    body: alertBody,
  });
}

