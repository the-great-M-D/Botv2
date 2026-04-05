import { isAdmin } from "../utils/admin.js";

export default {
  name: "ban",
  description: "[Admin] Block a user from messaging the bot. Usage: !ban <phone_number>",
  execute: async ({ sock, sender, args }) => {
    if (!isAdmin(sender)) {
      return sock.sendMessage(sender, { text: "⛔ Admin only." });
    }

    const phone = args[0]?.replace(/\D/g, "");

    if (!phone) {
      return sock.sendMessage(sender, {
        text: "Usage: !ban <phone_number>\nExample: !ban 27600000000",
      });
    }

    const jid = `${phone}@s.whatsapp.net`;

    try {
      await sock.updateBlockStatus(jid, "block");
      await sock.sendMessage(sender, { text: `🚫 Blocked: +${phone}` });
    } catch (err) {
      await sock.sendMessage(sender, { text: `❌ Failed to block: ${err.message}` });
    }
  },
};
