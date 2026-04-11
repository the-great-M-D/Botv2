export default {
  ownerOnly: true,
  adminOnly: true,
  name: "listreplies",
  description: "[Admin] List all auto-reply rules",
  execute: async ({ sock, msg, sender, db, tables }) => {
    const jid = msg.key.remoteJid;
    const { waAutoRepliesTable } = tables;
    const rows = await db.select().from(waAutoRepliesTable).limit(20);

    if (!rows.length) {
      return sock.sendMessage(jid, { text: "No auto-reply rules configured." }, { quoted: msg });
    }

    const lines = ["*🔁 Auto-Reply Rules*\n"];
    rows.forEach((r, i) => {
      const status = r.enabled ? "✅" : "❌";
      lines.push(`${i + 1}. ${status} [${r.matchType}] "${r.trigger}" → "${r.response}" (hits: ${r.hitCount})`);
    });

    await sock.sendMessage(jid, { text: lines.join("\n") }, { quoted: msg });
  },
};
