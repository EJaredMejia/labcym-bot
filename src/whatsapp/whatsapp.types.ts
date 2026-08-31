export interface WhatsAppWebhookPayload {
  object: "whatsapp_business_account" | string;
  entry?: WhatsAppEntry[];
}

export interface WhatsAppEntry {
  id: string; // WhatsApp Business Account ID
  changes?: WhatsAppChange[];
}

export interface WhatsAppChange {
  field: "messages" | "message_template_status_update" | "account_update" | string;
  value: WhatsAppValue;
}

export interface WhatsAppValue {
  messaging_product: "whatsapp" | string;
  metadata: WhatsAppMetadata;
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatus[];
  errors?: WhatsAppError[];
}

export interface WhatsAppMetadata {
  display_phone_number: string;
  phone_number_id: string;
}

export interface WhatsAppContact {
  profile: {
    name: string;
  };
  wa_id: string;
}

export type WhatsAppMessageType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "sticker"
  | "location"
  | "contacts"
  | "interactive"
  | "button"
  | "reaction"
  | "order"
  | "system"
  | "unknown";

export interface WhatsAppMedia {
  id: string;
  mime_type: string;
  sha256?: string;
  caption?: string;
  filename?: string;
  voice?: boolean;
}

export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: WhatsAppMessageType | string;
  text?: {
    body: string;
  };
  image?: WhatsAppMedia;
  audio?: WhatsAppMedia;
  video?: WhatsAppMedia;
  document?: WhatsAppMedia;
  sticker?: WhatsAppMedia;
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  reaction?: {
    message_id: string;
    emoji: string;
  };
  interactive?: {
    type: "button_reply" | "list_reply";
    button_reply?: {
      id: string;
      title: string;
    };
    list_reply?: {
      id: string;
      title: string;
      description?: string;
    };
  };
  button?: {
    payload: string;
    text: string;
  };
  context?: {
    forwarded?: boolean;
    frequently_forwarded?: boolean;
    from?: string;
    id?: string;
    referred_product?: {
      catalog_id: string;
      product_retailer_id: string;
    };
  };
  errors?: WhatsAppError[];
}

export interface WhatsAppStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  conversation?: {
    id: string;
    origin?: {
      type: string;
    };
    expiration_timestamp?: string;
  };
  pricing?: {
    billable: boolean;
    pricing_model: string;
    category: string;
  };
  errors?: WhatsAppError[];
}

export interface WhatsAppError {
  code: number;
  title: string;
  message?: string;
  error_data?: {
    details: string;
  };
}

// -------------------------------------------------------------
// Outgoing Message Payloads & API Response Types
// -------------------------------------------------------------

export interface WhatsAppTextMessagePayload {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "text";
  text: {
    preview_url?: boolean;
    body: string;
  };
}

export interface WhatsAppInteractiveButton {
  type: "reply";
  reply: {
    id: string;
    title: string;
  };
}

export interface WhatsAppInteractiveButtonPayload {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "interactive";
  interactive: {
    type: "button";
    header?: {
      type: "text";
      text: string;
    };
    body: {
      text: string;
    };
    footer?: {
      text: string;
    };
    action: {
      buttons: WhatsAppInteractiveButton[];
    };
  };
}

export interface WhatsAppInteractiveListSection {
  title: string;
  rows: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
}

export interface WhatsAppInteractiveListPayload {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "interactive";
  interactive: {
    type: "list";
    header?: {
      type: "text";
      text: string;
    };
    body: {
      text: string;
    };
    footer?: {
      text: string;
    };
    action: {
      button: string;
      sections: WhatsAppInteractiveListSection[];
    };
  };
}

export type WhatsAppOutgoingPayload =
  | WhatsAppTextMessagePayload
  | WhatsAppInteractiveButtonPayload
  | WhatsAppInteractiveListPayload;

export interface WhatsAppSendResponse {
  messaging_product: "whatsapp";
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
  }>;
}
