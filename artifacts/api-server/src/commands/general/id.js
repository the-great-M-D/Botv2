export default {
  name: 'id',
  description: 'Show your WhatsApp ID',
  // We wrap the arguments in { } to "destructure" the object from the handler
  execute: async ({ sock, sender }) => { 
    try {
      // 'sender' is already the JID (e.g., '123456789@s.whatsapp.net')
      const number = sender.split('@')[0];

      await sock.sendMessage(sender, { 
        text: `📱 *Your WhatsApp ID:*\n\n${number}` 
      });

    } catch (err) {
      console.log("Error in ID command:", err);
    }
  }
}

