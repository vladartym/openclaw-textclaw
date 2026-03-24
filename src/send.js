import * as api from "./api.js";
import { storeHandle, getLastInboundHandle } from "./handle-store.js";

/**
 * Send a message to a peer via TextClaw relay.
 * @param {object} account - Resolved account config
 * @param {string} peer - Recipient phone number (E.164)
 * @param {string} text - Message content
 * @param {object} [options]
 * @param {string} [options.mediaUrl] - Media attachment URL
 * @returns {Promise<{ messageId: string }>}
 */
export async function sendMessageToPeer(account, peer, text, options = {}) {
  const result = await api.sendMessage(
    null, // fromNumber not needed — TextClaw uses shared BYOC number
    peer,
    text,
    options.mediaUrl || null,
  );

  // Store the message_handle for future reactions
  if (result.message_handle) {
    storeHandle(peer, result.message_handle, "outbound");
  }

  return {
    messageId: result.message_handle || result.external_message_id || "",
  };
}

/**
 * Send a voice note to a peer via TextClaw relay.
 * The server converts the audio to .caf for inline iMessage playback.
 * @param {object} account - Resolved account config
 * @param {string} peer - Recipient phone number (E.164)
 * @param {string} mediaUrl - URL to an audio file
 * @returns {Promise<{ messageId: string }>}
 */
export async function sendVoiceNoteToPeer(account, peer, mediaUrl) {
  const result = await api.sendVoiceNote(null, peer, mediaUrl);

  if (result.message_handle) {
    storeHandle(peer, result.message_handle, "outbound");
  }

  return {
    messageId: result.message_handle || result.external_message_id || "",
  };
}

/**
 * Send typing indicator to a peer.
 * @param {object} account - Resolved account config
 * @param {string} peer - Recipient phone number (E.164)
 */
export async function sendTyping(account, peer) {
  try {
    await api.sendTypingIndicator(null, peer);
  } catch (err) {
    // Typing indicators are best-effort
    console.warn(`[textclaw] typing indicator failed for ${peer}: ${err.message}`);
  }
}

/**
 * Send a reaction (tapback) to the last inbound message from a peer.
 * @param {object} account - Resolved account config
 * @param {string} peer - Phone number of the conversation
 * @param {"heart"|"thumbsup"|"thumbsdown"|"laugh"|"emphasize"|"question"} reaction
 * @param {string} [messageHandle] - Specific message to react to (defaults to last inbound)
 */
export async function sendReactionToPeer(account, peer, reaction, messageHandle = null) {
  const handle = messageHandle || getLastInboundHandle(peer);
  if (!handle) {
    console.warn(`[textclaw] no message handle found for ${peer}, cannot send reaction`);
    return;
  }

  await api.sendReaction(null, handle, reaction);
}

/**
 * Chunk text into iMessage-friendly segments.
 * @param {string} text
 * @param {number} [maxLen=4000]
 * @returns {string[]}
 */
export function chunkText(text, maxLen = 4000) {
  if (text.length <= maxLen) return [text];

  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    // Try to break at a newline or space
    let breakAt = remaining.lastIndexOf("\n", maxLen);
    if (breakAt < maxLen * 0.5) {
      breakAt = remaining.lastIndexOf(" ", maxLen);
    }
    if (breakAt < maxLen * 0.5) {
      breakAt = maxLen;
    }
    chunks.push(remaining.slice(0, breakAt));
    remaining = remaining.slice(breakAt).trimStart();
  }
  return chunks;
}
