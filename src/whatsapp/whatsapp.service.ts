import { getDay, getHours, getMinutes } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { sendNtfyAlert } from "../notifications/ntfy.service";
import { sendButtonMessage, sendTextMessage } from "./whatsapp.client";

const HONDURAS_TIMEZONE = "America/Tegucigalpa";

interface CheckBusinessHoursResult {
  isOpen: boolean;
  message: string;
}

export function checkBusinessHours(
  timezone = HONDURAS_TIMEZONE
): CheckBusinessHoursResult {
  const zonedDate = toZonedTime(new Date(), timezone);
  const dayOfWeek = getDay(zonedDate); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const hours = getHours(zonedDate);
  const minutes = getMinutes(zonedDate);
  const currentMinutes = hours * 60 + minutes;

  // 0 = Sunday (Closed)
  if (dayOfWeek === 0) {
    return {
      isOpen: false,
      message:
        "⚠️ En este momento nos encontramos fuera de horario de atención.\n\n" +
        "📅 *Horarios de atención personalizada:*\n" +
        "• Lunes a Viernes: 8:00 AM - 4:00 PM\n" +
        "• Sábados: 8:00 AM - 12:00 PM\n" +
        "• Domingos: Cerrado\n\n" +
        "Deja tu mensaje o duda y con gusto te responderemos el lunes a primera hora.",
    };
  }

  // 6 = Saturday: 8:00 AM - 12:00 PM (480 to 720 mins)
  if (dayOfWeek === 6) {
    const isSaturdayOpen = currentMinutes >= 480 && currentMinutes < 720;
    if (!isSaturdayOpen) {
      return {
        isOpen: false,
        message:
          "⚠️ En este momento nos encontramos fuera de horario de atención.\n\n" +
          "📅 *Horario de los sábados:* 8:00 AM a 12:00 PM.\n\n" +
          "Deja tu consulta y te responderemos el lunes a las 8:00 AM.",
      };
    }

    return {
      isOpen: true,
      message:
        "✅ Espera un momento, por favor, que ya le atienden. Por favor describe tu consulta y en breve nos comunicaremos contigo.",
    };
  }

  // 1-5 = Monday to Friday: 8:00 AM - 4:00 PM (480 to 960 mins)
  const isWeekdayOpen = currentMinutes >= 480 && currentMinutes < 960;
  if (!isWeekdayOpen) {
    return {
      isOpen: false,
      message:
        "⚠️ En este momento nos encontramos fuera de horario de atención.\n\n" +
        "📅 *Horarios de atención personalizada:*\n" +
        "• Lunes a Viernes: 8:00 AM - 4:00 PM\n" +
        "• Sábados: 8:00 AM - 12:00 PM\n" +
        "• Domingos: Cerrado\n\n" +
        "Déjanos tu mensaje y te responderemos tan pronto abramos.",
    };
  }

  return {
    isOpen: true,
    message:
      "✅ Espera un momento, por favor, que ya le atienden. Por favor describe tu consulta y en breve nos comunicaremos contigo.",
  };
}

interface ProcessUserMessageParams {
  token: string;
  phoneNumberId: string;
  recipientPhone: string;
  userInput: string;
  adminPhoneNumber?: string;
  ntfyTopic?: string;
}

export async function processUserMessage(params: ProcessUserMessageParams) {
  const {
    token,
    phoneNumberId,
    recipientPhone,
    userInput,
    adminPhoneNumber,
    ntfyTopic,
  } = params;
  const normalized = userInput.trim().toLowerCase();

  // 1. Ubicación y Horarios
  const isLocationQuery =
    normalized === "btn_info" ||
    normalized.includes("ubicacion") ||
    normalized.includes("ubicación") ||
    normalized.includes("horario") ||
    normalized.includes("direccion") ||
    normalized.includes("dirección") ||
    normalized.includes("donde estan") ||
    normalized.includes("dónde están");

  if (isLocationQuery) {
    const text =
      "📍 *Ubicación y Horarios*\n\n" +
      "🕒 *Horarios de atención:*\n" +
      "• Lunes a Viernes: 8:00 AM - 4:00 PM\n" +
      "• Sábados: 8:00 AM - 12:00 PM\n" +
      "• Domingos: Cerrado\n\n" +
      "📌 *Dirección:* Puedes visitarnos en nuestras instalaciones durante nuestro horario laboral.";

    return sendButtonMessage({
      token,
      phoneNumberId,
      to: recipientPhone,
      bodyText: text,
      buttons: [
        { id: "btn_human", title: "Solicitar servicio al cliente" },
        { id: "btn_menu", title: "Volver al menú" },
      ],
      headerText: "Información General",
    });
  }

  // 2. Hablar con una persona / Atención personalizada
  const isHumanQuery =
    normalized === "btn_human" ||
    normalized.includes("humano") ||
    normalized.includes("asesor") ||
    normalized.includes("persona") ||
    normalized.includes("hablar") ||
    normalized.includes("atencion") ||
    normalized.includes("atención");

  if (isHumanQuery) {
    const { isOpen, message } = checkBusinessHours();

    // Reply to the client first
    await sendTextMessage({
      token,
      phoneNumberId,
      to: recipientPhone,
      text: message,
    });

    // TEMP TEST: Always send ntfy notification regardless of isOpen status
    if (ntfyTopic) {
      await sendNtfyAlert({
        topic: ntfyTopic,
        clientPhone: recipientPhone,
      });
    }

    if (!isOpen) return;

    // Optional direct WhatsApp alert if adminPhoneNumber is also configured
    if (adminPhoneNumber && adminPhoneNumber !== recipientPhone) {
      const alertText =
        "🔔 *¡NUEVA SOLICITUD DE ATENCIÓN!* 🔔\n\n" +
        `El cliente *+${recipientPhone}* ha solicitado atención.\n\n` +
        `👉 *Abrir chat con cliente:* https://wa.me/${recipientPhone}`;

      await sendTextMessage({
        token,
        phoneNumberId,
        to: adminPhoneNumber,
        text: alertText,
      });
    }

    return;
  }

  // 3. Menú Principal interactivo (Default fallback)
  const welcomeText =
    "👋 ¡Hola! Bienvenido a nuestro servicio de atención automática.\n\n" +
    "Selecciona una de las siguientes opciones para ayudarte:";

  return sendButtonMessage({
    token,
    phoneNumberId,
    to: recipientPhone,
    bodyText: welcomeText,
    buttons: [
      { id: "btn_info", title: "Ubicación y Horario" },
      { id: "btn_human", title: "Atención al cliente" },
    ],
    headerText: "Menú Principal",
    footerText: "Toca un botón para continuar",
  });
}
