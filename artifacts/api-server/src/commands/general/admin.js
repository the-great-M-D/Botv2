//import { isAdmin } from '..../utils/admin.js'
//import { OWNER_ID } from '..../utils/owner.js'

export default {
  ownerOnly: true,
  name: 'owner',
  description: 'Show owner info and verify your identity',
  async execute({sock, msg,  args}) {
    const sender = msg.key.participant || msg.key.remoteJid
    const ownerNum = OWNER_ID.split('@')[0]

    if (isAdmin) {
      const lines = [
        '╔═══════════════════════╗',
        '║    👑 *OWNER INFO*    ║',
        '╚═══════════════════════╝',
        '',
        `✅ *You are the owner.*`,
        '',
        `📛 *Configured ID:* M-D`,
        `📱 *Number:* 069 783 4825`,
        `🔑 *Your sender ID:* ${sender}`,
        '',
        '_All owner-only commands are unlocked for you._'
      ]
      return await sock.sendMessage(sender, { text: lines.join('\n') }, { quoted: msg })
    }

    // Not the owner — show limited public info
    const lines = [
      '👑 *Bot Owner*',
      '',
      `📱 Contact: 27 069 783 4825`,
      '',
      '_You are not the owner of this bot._'
    ]
      return await sock.sendMessage(sender, { text: lines.join('\n') }, { quoted: msg })
  }
}
