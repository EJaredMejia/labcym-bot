import { getBaileysSocket } from "./baileys.service";

export interface SendBaileysTextMessageParams {
  to: string; // remoteJid or phone number
  text: string;
}

export interface MenuItem {
  id?: string;
  title: string;
}

export interface SendBaileysMenuMessageParams {
  to: string;
  bodyText: string;
  options: MenuItem[];
  headerText?: string;
  footerText?: string;
}

export interface SendBaileysLocationMessageParams {
  to: string;
  degreesLatitude: number;
  degreesLongitude: number;
  name?: string;
  address?: string;
}

function normalizeJid(to: string): string {
  if (to.includes("@")) return to;
  return `${to.replace(/\D/g, "")}@s.whatsapp.net`;
}

/**
 * Sends a plain text message via Baileys socket.
 */
export async function sendTextMessage(params: SendBaileysTextMessageParams) {
  const socket = getBaileysSocket();
  const jid = normalizeJid(params.to);
  return socket.sendMessage(jid, { text: params.text });
}

/**
 * Sends a native WhatsApp location pin message via Baileys socket.
 */
export async function sendLocationMessage(
  params: SendBaileysLocationMessageParams,
) {
  const socket = getBaileysSocket();
  const jid = normalizeJid(params.to);
  return socket.sendMessage(jid, {
    location: {
      degreesLatitude: params.degreesLatitude,
      degreesLongitude: params.degreesLongitude,
      name: params.name,
      address: params.address,
    },
  });
}

/**
 * Sends a numbered interactive menu format compatible with all WhatsApp clients.
 * Formats options cleanly with numbers so users can easily respond.
 */
export async function sendMenuMessage(params: SendBaileysMenuMessageParams) {
  const socket = getBaileysSocket();
  const jid = normalizeJid(params.to);

  let formatted = "";
  if (params.headerText) {
    formatted += `*${params.headerText}*\n\n`;
  }
  formatted += `${params.bodyText}\n\n`;

  params.options.forEach((opt, index) => {
    formatted += `*${index + 1}.* ${opt.title}\n`;
  });

  if (params.footerText) {
    formatted += `\n_${params.footerText}_`;
  } else {
    formatted += `\n_Responde con el número de tu opción._`;
  }

  return socket.sendMessage(jid, { text: formatted });
}

