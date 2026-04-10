export default {
    name: 'info',
    description: 'Show info about this chat or group',
    execute: async ({msg, sock, args}) => {
        // In Baileys, the ID is usually in msg.key.remoteJid
        const jid = msg.key.remoteJid;
        const isGroup = jid.endsWith('@g.us');

        if (isGroup) {
            try {
                // Fetch group metadata from the socket
                const groupMetadata = await sock.groupMetadata(jid);
                
                const name = groupMetadata.subject || 'Unknown';
                const participants = groupMetadata.participants.length || 0;
                const desc = groupMetadata.desc 
                    ? `\n📝 ${groupMetadata.desc.toString()}` 
                    : '';

                const responseText = 
                    `👥 *Group Info*\n\n` +
                    `*Name:* ${name}\n` +
                    `*Members:* ${participants}` +
                    desc;

                // Send message using the socket
                await sock.sendMessage(jid, { text: responseText }, { quoted: msg });

            } catch (e) {
                console.error(e);
                await sock.sendMessage(jid, { text: '⚠️ Could not fetch group info.' }, { quoted: msg });
            }
        } else {
            // Logic for private chats
            const sender = msg.key.participant || jid;
            await sock.sendMessage(jid, { text: `This is a private chat with ${sender.split('@')[0]}` }, { quoted: msg });
        }
    }
};

