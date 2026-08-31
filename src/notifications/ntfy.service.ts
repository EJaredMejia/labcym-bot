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
}

export async function sendNtfyAlert(params: SendNtfyAlertParams): Promise<void> {
  const { topic, clientPhone } = params;
  if (!topic) return;

  const chatUrl = `https://wa.me/${clientPhone}`;

  await ntfyFetch(`/${topic}`, {
    method: "POST",
    headers: {
      Title: "Lab-Cym: Solicitud de Asesor",
      Priority: "urgent",
      Tags: "rotating_light,whatsapp",
      Click: chatUrl,
      Actions: `view, Abrir Chat WhatsApp, ${chatUrl}`,
    },
    body: `El cliente +${clientPhone} está solicitando atención personalizada. Toca para abrir WhatsApp.`,
  });
}
