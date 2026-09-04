import { initBaileys } from "./whatsapp/baileys.service";

console.log("=========================================");
console.log("   🚀 Starting LABCYM WhatsApp Bot 🚀   ");
console.log("=========================================");

// Initialize Baileys WhatsApp client
initBaileys().catch((err) => {
  console.error("💥 Fatal error starting Baileys client:", err);
  process.exit(1);
});
