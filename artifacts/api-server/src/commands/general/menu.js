export default {
  name: 'menu',
  description: 'Show all available commands',
  execute: async ({sock, sender, msg, client, args, commands}) => {
    const lines = [
      '╔════════════════════════╗',
      '║     🤖 *BOT  MENU*     ║',
      '╚════════════════════════╝',
      '',
    ]

    if (commands && commands.size > 0) {
      const sorted = [...commands.values()].sort((a, b) => a.name.localeCompare(b.name))
      for (const cmd of sorted) {
        const desc = cmd.description ? cmd.description : 'No description'
        lines.push(`┃ *!${cmd.name}*`)
        lines.push(`┃  ↳ _${desc}_`)
        lines.push('┃')
      }
      lines[lines.length - 1] = '┗━━━━━━━━━━━━━━━━━━━━━━━━━'
    } else {
      lines.push('No commands loaded.')
    }

    return await sock.sendMessage(sender, { text: lines.join('\n') }, { quoted: msg })
  }
}
