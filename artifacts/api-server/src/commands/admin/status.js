export default {
  name: "status",
  description: "Show bot status and uptime — owner only",
  usage: "!status",
  ownerOnly: true,

  async execute({ sock, msg, getBotInfo }) {
    const jid = msg.key.remoteJid;
    const start = Date.now();
    const info = typeof getBotInfo === "function" ? getBotInfo() : {};

    let uptimeStr = "unknown";
    if (info.connectedAt) {
      const uptime = Math.floor((Date.now() - new Date(info.connectedAt).getTime()) / 1000);
      uptimeStr = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`;
    }

    await sock.sendMessage(jid, {
      text:
        "🤖 *BOT STATUS*\n\n" +
        `*State:* ${info.state || "unknown"}\n` +
        `*Phone:* ${info.phoneNumber || "n/a"}\n` +
        `*Device:* ${info.deviceName || "n/a"}\n` +
        `*Uptime:* ${uptimeStr}\n` +
        `*Latency:* ${Date.now() - start}ms`,
    });
  },
};
