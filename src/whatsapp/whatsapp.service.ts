import { getDay, getHours, getMinutes } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { sendNtfyAlert } from "../notifications/ntfy.service";
import { isChatPaused, pauseChat, resumeChat } from "../redis/session.service";
import {
  sendButtonMessage,
  sendTextMessage
} from "./whatsapp.client";

const HONDURAS_TIMEZONE = "America/Tegucigalpa";
const WEBSITE_URL = "https://sites.google.com/view/labcym/inicio";

interface CheckBusinessHoursResult {
  isOpen: boolean;
  message: string;
}

export function checkBusinessHours(
  timezone = HONDURAS_TIMEZONE,
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

  // 1. Requisitos para exámenes (Opción 2 del menú de la imagen)
  const isRequirementsQuery =
    normalized === "opt_requisitos" ||
    normalized.includes("requisito") ||
    normalized.includes("ayuno") ||
    normalized.includes("indicacion") ||
    normalized.includes("indicación") ||
    normalized.includes("examen") ||
    normalized.includes("exámenes");

  if (isRequirementsQuery) {
    // Pause bot responses for 1 hour so the user can send photos/questions without bot interruptions
    await pauseChat(recipientPhone, 3600);

    if (ntfyTopic) {
      await sendNtfyAlert({
        topic: ntfyTopic,
        clientPhone: recipientPhone,
        title: "Labcym: Consulta de Requisitos de Exámenes",
        message: `El cliente +${recipientPhone} está consultando los requisitos para sus exámenes (ayuno, indicaciones).`,
      });
    }

    const text =
      "📋 *Requisitos para tus Exámenes*\n\n" +
      "¡Con gusto te orientamos!\n\n" +
      "Hemos notificado a nuestro equipo sobre tu consulta. Por favor escríbenos qué tipo de examen necesitas realizarte o envíanos una foto de tu orden médica, y en breve te indicaremos las instrucciones necesarias (tiempo de ayuno, preparación, etc.).\n\n" +
      `🌐 También puedes consultar información general en nuestro sitio web:\n${WEBSITE_URL}\n\n` +
      "💡 _Si deseas volver a hablar con el bot en cualquier momento, escribe *salir*._";

    return sendButtonMessage({
      token,
      phoneNumberId,
      to: recipientPhone,
      bodyText: text,
      buttons: [
        { id: "btn_menu", title: "Ver menú principal" },
        { id: "opt_asesor", title: "Hablar con asesor" },
      ],
      headerText: "Requisitos de Exámenes",
    });
  }

  // 2. Consultar o recibir resultados (Opción 4 del menú)
  const isResultsQuery =
    normalized === "opt_resultados" ||
    normalized.includes("resultado") ||
    normalized.includes("recibir") ||
    normalized.includes("consultar resultado");

  if (isResultsQuery) {
    const text =
      "📑 *Consulta y Entrega de Resultados*\n\n" +
      "En *LABCYM* te facilitamos la entrega de tus resultados:\n\n" +
      "📩 *Vía Correo Electrónico:* Te enviamos tus resultados en formato PDF directamente a tu email.\n" +
      "📲 *Vía WhatsApp:* Podemos compartirlos directamente por este chat.\n\n" +
      "Si deseas consultar el estado de tus resultados o solicitarlos, indícanos tu nombre completo y número de identidad o déjanos tu mensaje aquí.";

    return sendButtonMessage({
      token,
      phoneNumberId,
      to: recipientPhone,
      bodyText: text,
      buttons: [
        { id: "btn_menu", title: "Ver menú principal" },
        { id: "opt_asesor", title: "Hablar con asesor" },
      ],
      headerText: "Entrega de Resultados",
    });
  }

  // 3. Ubicaciones y horarios de atención (Opción 5 del menú)
  const isLocationQuery =
    normalized === "opt_ubicacion" ||
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
      "📍 *Ubicación y Horarios de Atención*\n\n" +
      "🏢 *Dirección exacta:*\n" +
      "Laboratorio clínico LABCYM barrio villadela 6ta avenida entre 15 y 16 calle No 1509 primera planta local 2 en el pasillo frente a carnitas villadela.\n\n" +
      "🕒 *Horarios de atención:*\n" +
      "• Lunes a Viernes: 8:00 AM - 4:00 PM\n" +
      "• Sábados: 8:00 AM - 12:00 PM\n" +
      "• Domingos: Cerrado\n\n" +
      `🌐 Para ver más información en nuestro sitio web:\n${WEBSITE_URL}`;

    return sendButtonMessage({
      token,
      phoneNumberId,
      to: recipientPhone,
      bodyText: text,
      buttons: [
        { id: "btn_menu", title: "Ver menú principal" },
        { id: "opt_asesor", title: "Hablar con asesor" },
      ],
      headerText: "Ubicación y Horarios",
    });
  }

  // 4. Hablar con un asesor (Opción 6 del menú)
  const isHumanQuery =
    normalized === "opt_asesor" ||
    normalized === "btn_human" ||
    normalized.includes("asesor") ||
    normalized.includes("humano") ||
    normalized.includes("persona") ||
    normalized.includes("hablar") ||
    normalized.includes("atencion") ||
    normalized.includes("atención");

  if (isHumanQuery) {
    const { isOpen, message } = checkBusinessHours();

    // Pause bot responses for 1 hour so the human conversation is uninterrupted
    await pauseChat(recipientPhone, 3600);

    const fullMessage =
      message +
      "\n\n💡 _Si deseas cancelar la atención con el asesor y regresar al bot, escribe *salir*._";

    // Reply to the client first
    await sendTextMessage({
      token,
      phoneNumberId,
      to: recipientPhone,
      text: fullMessage,
    });

    // Send ntfy notification
    if (ntfyTopic) {
      await sendNtfyAlert({
        topic: ntfyTopic,
        clientPhone: recipientPhone,
        title: "Labcym: Solicitud de Atención al cliente",
        message: `El cliente +${recipientPhone} ha solicitado hablar con un asesor.`,
      });
    }

    if (!isOpen) return;

    // Optional direct WhatsApp alert if adminPhoneNumber is configured
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

  // 5. Menú Principal con 3 botones interactivos
  const menuBody =
    "¡Hola! 👋 Te damos la bienvenida a *LABCYM*, tu laboratorio clínico de confianza.\n\n" +
    "Estamos aquí para atenderte de forma rápida y sencilla. ¿Cómo podemos ayudarte hoy?\n\n" +
    `🌐 *Sitio Web:* ${WEBSITE_URL}`;

  return sendButtonMessage({
    token,
    phoneNumberId,
    to: recipientPhone,
    headerText: "Laboratorio LABCYM",
    bodyText: menuBody,
    footerText: "Toca un botón para continuar",
    buttons: [
      { id: "opt_resultados", title: "Mis resultados" },
      { id: "opt_ubicacion", title: "Ubicación y horario" },
      { id: "opt_asesor", title: "Hablar con asesor" },
    ],
  });
}

