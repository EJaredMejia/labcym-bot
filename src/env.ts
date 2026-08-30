import { env } from "@yolk-oss/elysia-env";
import { t } from "elysia";

export const envPlugin = env({
  WHATSAPP_TOKEN: t.String(),
  WHATSAPP_VERIFY_TOKEN: t.String(),
  WHATSAPP_PHONE_NUMBER_ID: t.Optional(t.String()),
  PORT: t.Optional(t.Numeric({ default: 3000 })),
});
