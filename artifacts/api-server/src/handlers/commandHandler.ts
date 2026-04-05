export async function handleCommand({
  sock,
  msg,
  text,
  commands,
  prefix,
  db,
  tables,
  getBotInfo,
}) {
  if (!text.startsWith(prefix)) return false;

  const sender = msg.key.remoteJid;
  const args = text.slice(prefix.length).trim().split(" ");
  const commandName = args.shift()?.toLowerCase();

  const command = commands.get(commandName);

  if (!command) {
    await sock.sendMessage(sender, { text: "Unknown command 🤨" });
    return true;
  }

  try {
    await command.execute({ sock, sender, args, commands, db, tables, getBotInfo });
  } catch (err) {
    console.log("Command error:", err);
    await sock.sendMessage(sender, { text: "Command failed 💀" });
  }

  return true;
}
