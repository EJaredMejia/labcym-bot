import { getDay, getHours, getMinutes } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { sendNtfyAlert } from "../notifications/ntfy.service";
import { isChatPaused, pauseChat, resumeChat } from "../redis/session.service";
import {
  sendLocationMessage,
  sendMenuMessage,
  sendTextMessage,
} from "./whatsapp.client";

const HONDURAS_TIMEZONE = "America/Tegucigalpa";
const WEBSITE_URL = "https://sites.google.com/view/labcym/inicio";
const GOOGLE_MAPS_URL = "https://maps.google.com/?q=Laboratorio+Clinico+LABCYM+Villadela";

// Coordenadas aproximadas de Barrio Villadela, Tegucigalpa
const LABCYM_LOCATION = {
  degreesLatitude: 14.08639,
  degreesLongitude: -87.21444,
  name: "Laboratorio Clínico LABCYM",
  address: "Barrio Villadela, 6ta Avenida, entre 15 y 16 Calle #1509",
};

export const BUSINESS_SCHEDULE_TEXT =
  "• Lunes a Viernes: 8:00 AM - 4:00 PM\n" +
  "• Sábados: 8:00 AM - 12:00 PM\n" +
  "• Domingos: Cerrado";

export const OUT_OF_HOURS_MESSAGE =
  "*Horario de atención*\n\n" +
  "Actualmente nos encontramos fuera de nuestro horario de servicio.\n\n" +
  "*Horarios de atención:*\n" +
  BUSINESS_SCHEDULE_TEXT + "\n\n" +
  "Déjanos tu mensaje y te responderemos lo más pronto posible.";

export const AGENT_CONNECTING_MESSAGE =
  "Ya te atenderemos. Un asesor se comunicará contigo en breve. Por favor describe detalladamente tu consulta.";

interface CheckBusinessHoursResult {
  isOpen: boolean;
  message: string;
}

export function checkBusinessHours(
  timezone = HONDURAS_TIMEZONE,
): CheckBusinessHoursResult {
  const zonedDate = toZonedTime(new Date(), timezone);
  const dayOfWeek = getDay(zonedDate); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const currentMinutes = getHours(zonedDate) * 60 + getMinutes(zonedDate);

  // 0 = Sunday (Closed)
  if (dayOfWeek === 0) {
    return {
      isOpen: false,
      message: OUT_OF_HOURS_MESSAGE,
    };
  }

  // 6 = Saturday: 8:00 AM - 12:00 PM (480 to 720 mins)
  if (dayOfWeek === 6) {
    const isSaturdayOpen = currentMinutes >= 480 && currentMinutes < 720;
    if (!isSaturdayOpen) {
      return {
        isOpen: false,
        message: OUT_OF_HOURS_MESSAGE,
      };
    }

    return {
      isOpen: true,
      message: AGENT_CONNECTING_MESSAGE,
    };
  }

  // 1-5 = Monday to Friday: 8:00 AM - 4:00 PM (480 to 960 mins)
  const isWeekdayOpen = currentMinutes >= 480 && currentMinutes < 960;
  if (!isWeekdayOpen) {
    return {
      isOpen: false,
      message: OUT_OF_HOURS_MESSAGE,
    };
  }

  return {
    isOpen: true,
    message: AGENT_CONNECTING_MESSAGE,
  };
}

export interface ProcessUserMessageParams {
  recipientPhone: string;
  remoteJid: string;
  userInput: string;
  productTitle?: string;
  ntfyTopic?: string;
}

export async function processUserMessage(params: ProcessUserMessageParams) {
  const {
    recipientPhone,
    remoteJid,
    userInput,
    productTitle,
    ntfyTopic = "",
  } = params;
  const normalized = userInput.trim().toLowerCase();

  // Handle WhatsApp Catalog / Product Inquiries
  if (productTitle) {
    await pauseChat(recipientPhone, 3600);

    if (ntfyTopic) {
      await sendNtfyAlert({
        topic: ntfyTopic,
        clientPhone: recipientPhone,
        title: "Labcym: Consulta sobre Producto de Catálogo",
        message: `El cliente +${recipientPhone} está consultando sobre el producto/examen: "${productTitle}".`,
      });
    }

    const reply =
      `*Consulta sobre:* ${productTitle}\n\n` +
      "Gracias por comunicarte con *LABCYM*. Hemos notificado a nuestro equipo sobre tu consulta y un asesor te atenderá a la brevedad para brindarte información sobre precios, disponibilidad y preparación requerida.\n\n" +
      "_Para utilizar el menú interactivo en cualquier momento, escribe *menu*._";

    await sendTextMessage({
      to: remoteJid,
      text: reply,
    });
    return;
  }

  // If user explicitly asks to return to menu or reset bot, unpause immediately
  const isExplicitMenuTrigger =
    normalized === "btn_menu" ||
    normalized === "menu" ||
    normalized === "menú" ||
    normalized === "salir" ||
    normalized === "cancelar" ||
    normalized === "inicio" ||
    normalized === "reiniciar" ||
    normalized === "empezar";

  if (isExplicitMenuTrigger) {
    await resumeChat(recipientPhone);
  } else {
    // Check if the chat is currently paused (agent takeover active)
    const paused = await isChatPaused(recipientPhone);
    if (paused) {
      console.log(
        `Chat with ${recipientPhone} is currently paused for human agent. Bot will remain silent.`,
      );
      return;
    }
  }

  // 1. Consultar o recibir resultados (Option 1 in main menu)
  const isResultsQuery = normalized === "1";

  if (isResultsQuery) {
    const text =
      "*Entrega y Consulta de Resultados*\n\n" +
      "Disponemos de las siguientes modalidades de entrega:\n\n" +
      "• *Correo electrónico:* Envío directo de tus resultados en formato PDF.\n" +
      "• *WhatsApp:* Podemos enviártelo a tu número telefónico de WhatsApp.\n\n" +
      "Para consultar el estado de tu orden, por favor indícanos tu nombre completo y número de identidad.\n\n" +
      "_Escribe *menu* para volver al menú principal o *3* para hablar con un asesor._";

    return sendTextMessage({
      to: remoteJid,
      text,
    });
  }

  // 2. Ubicaciones y horarios de atención (Option 2 in main menu)
  const isLocationQuery = normalized === "2";

  if (isLocationQuery) {
    const text =
      "*Ubicación y Horarios de Atención*\n\n" +
      "*Dirección:*\n" +
      "Laboratorio Clínico LABCYM, Barrio Villadela, 6ta Avenida, entre 15 y 16 Calle #1509, 1ra Planta, Local 2 (frente a Carnitas Villadela).\n\n" +
      "*Horarios:*\n" +
      BUSINESS_SCHEDULE_TEXT + "\n\n" +
      `*Google Maps:* ${GOOGLE_MAPS_URL}\n` +
      `*Sitio web:* ${WEBSITE_URL}\n\n` +
      "_Escribe *menu* para volver al menú principal._";

    await sendTextMessage({
      to: remoteJid,
      text,
    });

    return sendLocationMessage({
      to: remoteJid,
      ...LABCYM_LOCATION,
    });
  }

  // 3. Cotizaciones, requisitos y atención personalizada (Option 3 in main menu)
  const isHumanQuery = normalized === "3";

  if (isHumanQuery) {
    const { isOpen, message } = checkBusinessHours();

    await pauseChat(recipientPhone, 3600);

    const fullMessage =
      message +
      "\n\n_Escribe *menu* para cancelar la solicitud y volver al menú principal._";

    await sendTextMessage({
      to: remoteJid,
      text: fullMessage,
    });

    if (isOpen) {
      await sendNtfyAlert({
        topic: ntfyTopic,
        clientPhone: recipientPhone,
        title: "Labcym: Solicitud de Atención al cliente",
        message: `El cliente +${recipientPhone} ha solicitado atención personalizada (cotización / requisitos / dudas).`,
      });
    }

    return;
  }

  // 4. Menú Principal
  const menuBody =
    "Bienvenido al servicio de atención de *LABCYM*.\n\n" +
    "Seleccione una de las siguientes opciones para continuar:\n\n" +
    `Sitio web: ${WEBSITE_URL}`;

  return sendMenuMessage({
    to: remoteJid,
    headerText: "Laboratorio Clínico LABCYM",
    bodyText: menuBody,
    footerText: "Responda con el número de su opción",
    options: [
      { id: "opt_resultados", title: "Mis resultados" },
      { id: "opt_ubicacion", title: "Ubicación y horarios" },
      { id: "opt_asesor", title: "Cotizaciones y atención personalizada" },
    ],
  });
}

