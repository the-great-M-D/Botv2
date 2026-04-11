export default {
  name: "demote",
  description: "Demote a group admin to regular member",
  usage: "@mention or reply to their message",
  adminOnly: true,
  groupOnly: true,

  execute: async ({ sock, msg, args }) => {
    const jid = msg.key.remoteJid;

    // Priority 1: quoted message, Priority 2: @mention
    let targetJid = null;
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
    if (quoted) {
      targetJid = quoted;
    } else {
      const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
      if (mentions && mentions.length > 0) targetJid = mentions[0];
    }

    if (!targetJid) {
      await sock.sendMessage(jid,
        { text: "⚠️ Please @mention someone or reply to their message to demote them." },
        { quoted: msg });
      return;
    }

    const metadata = await sock.groupMetadata(jid);
    const participant = metadata.participants.find(
      (p) => p.id === targetJid || p.id.split(":")[0] + "@s.whatsapp.net" === targetJid
    );

    if (!participant) {
      await sock.sendMessage(jid, { text: "❌ That user is not in this group." }, { quoted: msg });
      return;
    }

    if (!participant.admin) {
      await sock.sendMessage(jid, { text: "ℹ️ That user is not an admin." }, { quoted: msg });
      return;
    }

    if (participant.admin === "superadmin") {
      await sock.sendMessage(jid, { text: "🔒 Cannot demote the group creator." }, { quoted: msg });
      return;
    }

    try {
      await sock.groupParticipantsUpdate(jid, [targetJid], "demote");
      await sock.sendMessage(jid,
        { text: `⬇️ @${targetJid.split("@")[0]} has been demoted to regular member.`, mentions: [targetJid] },
        { quoted: msg });
    } catch (err) {
      console.error("demote error:", err);
      await sock.sendMessage(jid,
        { text: "❌ Failed to demote. Make sure the bot is an admin in this group." },
        { quoted: msg });
    }
  },
};
