export default {
  name: "promote",
  description: "Promote a member to group admin",
  usage: "@mention or reply to their message",
  adminOnly: true,
  groupOnly: true,

  execute: async ({ sock, msg, args, isOwner }) => {
    const jid = msg.key.remoteJid;

    // ── Resolve target JID ────────────────────────────────────────────────
    // Priority 1: quoted message (replying to someone)
    // Priority 2: @mention in the message
    let targetJid = null;

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
    if (quoted) {
      targetJid = quoted;
    } else {
      const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
      if (mentions && mentions.length > 0) {
        targetJid = mentions[0];
      }
    }

    if (!targetJid) {
      await sock.sendMessage(
        jid,
        { text: "⚠️ Please @mention someone or reply to their message to promote them." },
        { quoted: msg }
      );
      return;
    }

    // ── Check they're actually in the group ──────────────────────────────
    const metadata = await sock.groupMetadata(jid);
    const participant = metadata.participants.find(
      (p) => p.id === targetJid || p.id.split(":")[0] + "@s.whatsapp.net" === targetJid
    );

    if (!participant) {
      await sock.sendMessage(
        jid,
        { text: "❌ That user is not in this group." },
        { quoted: msg }
      );
      return;
    }

    if (participant.admin === "admin" || participant.admin === "superadmin") {
      await sock.sendMessage(
        jid,
        { text: "ℹ️ That user is already an admin." },
        { quoted: msg }
      );
      return;
    }

    // ── Promote ───────────────────────────────────────────────────────────
    try {
      await sock.groupParticipantsUpdate(jid, [targetJid], "promote");
      const displayName = participant.name ?? targetJid.split("@")[0];
      await sock.sendMessage(
        jid,
        { text: `✅ @${targetJid.split("@")[0]} has been promoted to admin.`, mentions: [targetJid] },
        { quoted: msg }
      );
    } catch (err) {
      console.error("promote error:", err);
      await sock.sendMessage(
        jid,
        { text: "❌ Failed to promote. Make sure the bot is an admin in this group." },
        { quoted: msg }
      );
    }
  },
};
