import { Elysia } from "elysia";
import { envPlugin } from "./env";
import { whatsappRouter } from "./whatsapp/whatsapp.router";

const app = new Elysia()
  .use(envPlugin)
  .use(whatsappRouter)
  .get("/", () => "Hello Elysia");

if (process.env.NODE_ENV !== "production") {
  app.listen(process.env.PORT || 3000);
  console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
  );
}

export default app;

