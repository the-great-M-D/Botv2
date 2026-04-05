import { isAdmin } from "../utils/admin.js";

export default {
  name: "listreplies",
  description: "[Admin] List all auto-reply rules",
  execute: async ({ sock, sender, db, tables }) => {
    if (!isAdmin(sender)) {
      return sock.sendMessage(sender, { text: "⛔ Admin only." });
    }

    const { waAutoRepliesTable } = tables;
    const rows = await db.select().from(waAutoRepliesTable).limit(20);

    if (!rows.length) {
      return sock.sendMessage(sender, { text: "No auto-reply rules configured." });
    }

    const lines = ["*🔁 Auto-Reply Rules*\n"];
    rows.forEach((r, i) => {
      const status = r.enabled ? "✅" : "❌";
      lines.push(`${i + 1}. ${status} [${r.matchType}] "${r.trigger}" → "${r.response}" (hits: ${r.hitCount})`);
    });

    await sock.sendMessage(sender, { text: lines.join("\n") });
  },
};
