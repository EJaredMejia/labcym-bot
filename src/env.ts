import { env } from "@yolk-oss/elysia-env";
import { t } from "elysia";

export const envPlugin = env({
  WHATSAPP_TOKEN: t.String(),
  WHATSAPP_VERIFY_TOKEN: t.String(),
  WHATSAPP_PHONE_NUMBER_ID: t.Optional(t.String()),
  ADMIN_PHONE_NUMBER: t.Optional(t.String()),
  NTFY_TOPIC: t.Optional(t.String()),
  KV_REST_API_URL: t.Optional(t.String()),
  KV_REST_API_TOKEN: t.Optional(t.String()),
  UPSTASH_REDIS_REST_URL: t.Optional(t.String()),
  UPSTASH_REDIS_REST_TOKEN: t.Optional(t.String()),
  PORT: t.Optional(t.Numeric({ default: 3000 })),
});

