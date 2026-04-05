import { isAdmin } from "../utils/admin.js";

export default {
  name: "status",
  description: "[Admin] Show bot connection status",
  execute: async ({ sock, sender, getBotInfo }) => {
    if (!isAdmin(sender)) {
      return sock.sendMessage(sender, { text: "⛔ Admin only." });
    }

    const info = getBotInfo();
    const uptime = info.connectedAt
      ? formatDuration(Date.now() - new Date(info.connectedAt).getTime())
      : "N/A";

    const lines = [
      "*📡 Bot Status*",
      `• State: *${info.state}*`,
      `• Phone: ${info.phoneNumber ?? "N/A"}`,
      `• Device: ${info.deviceName ?? "N/A"}`,
      `• Platform: ${info.platform ?? "N/A"}`,
      `• Uptime: ${uptime}`,
    ];

    await sock.sendMessage(sender, { text: lines.join("\n") });
  },
};

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
