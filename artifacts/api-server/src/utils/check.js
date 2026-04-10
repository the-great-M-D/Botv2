import { OWNER_ID } from './owner.js';
import { isAdmin } from './admin.js';

/**
 * Checks if the sender has the required permission level.
 * @param {object} sock - The Baileys socket
 * @param {object} msg - The message object
 * @param {string} sender - The sender's JID
 * @param {string} level - 'owner' or 'admin'
 */
export const checkLevel = async (sock, msg, sender, level = 'admin') => {
    // The Owner is the "Superuser" — they bypass all checks.
    if (sender === OWNER_ID) return true;

    // If the command is ONLY for the owner, and we got here, they aren't the owner.
    if (level === 'owner') return false;

    // If it's a group command, check for admin status.
    if (msg.key.remoteJid.endsWith('@g.us')) {
        try {
            const metadata = await sock.groupMetadata(msg.key.remoteJid);
            return isAdmin(sender, metadata);
        } catch (e) {
            return false;
        }
    }

    // Default to false for private chats if they aren't the owner.
    return false;
};

