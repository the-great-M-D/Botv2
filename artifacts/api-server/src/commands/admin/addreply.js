import { randomUUID } from "crypto";

export default {
  ownerOnly: true,
  adminOnly: true,
  name: "addreply",
  description: "[Admin] Add auto-reply rule. Usage: !addreply <trigger> | <response>",
  execute: async ({ sock, msg, sender, args, db, tables }) => {
    const jid = msg.key.remoteJid;
    const raw = args.join(" ");
    const parts = raw.split("|");

    if (parts.length < 2) {
      return sock.sendMessage(jid, {
        text: "Usage: !addreply <trigger> | <response>\nExample: !addreply hello | Hi there!",
      }, { quoted: msg });
    }

    const trigger = parts[0].trim();
    const response = parts.slice(1).join("|").trim();

    if (!trigger || !response) {
      return sock.sendMessage(jid, { text: "⚠️ Trigger and response cannot be empty." }, { quoted: msg });
    }

    const { waAutoRepliesTable } = tables;
    await db.insert(waAutoRepliesTable).values({
      id: randomUUID(), trigger, response,
      matchType: "contains", caseSensitive: false, enabled: true, hitCount: 0,
    });

    await sock.sendMessage(jid, {
      text: `✅ Auto-reply added!\n• Trigger: "${trigger}"\n• Response: "${response}"`,
    }, { quoted: msg });
  },
};
