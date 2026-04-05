import { isAdmin } from "../utils/admin.js";

export default {
  name: "unban",
  description: "[Admin] Unblock a previously blocked user. Usage: !unban <phone_number>",
  execute: async ({ sock, sender, args }) => {
    if (!isAdmin(sender)) {
      return sock.sendMessage(sender, { text: "⛔ Admin only." });
    }

    const phone = args[0]?.replace(/\D/g, "");

    if (!phone) {
      return sock.sendMessage(sender, {
        text: "Usage: !unban <phone_number>\nExample: !unban 27600000000",
      });
    }

    const jid = `${phone}@s.whatsapp.net`;

    try {
      await sock.updateBlockStatus(jid, "unblock");
      await sock.sendMessage(sender, { text: `✅ Unblocked: +${phone}` });
    } catch (err) {
      await sock.sendMessage(sender, { text: `❌ Failed to unblock: ${err.message}` });
    }
  },
};
