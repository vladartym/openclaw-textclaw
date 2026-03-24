/**
 * HTTP client for TextClaw relay API.
 *
 * BYOC users route outbound messages through TextClaw's relay endpoints
 * which handle iMessage delivery on their behalf.
 */

let baseUrl = "";  // e.g. "https://textclaw.now/api/v1/byoc/relay"
let apiKey = "";

export function configure(url, key) {
  baseUrl = url.replace(/\/+$/, "") + "/api/v1/byoc/relay";
  apiKey = key;
}

export function getApiKey() {
  return apiKey;
}

async function request(method, path, body = null) {
  const url = `${baseUrl}${path}`;
  const headers = {
    "X-API-Key": apiKey,
    "Content-Type": "application/json",
  };

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const resp = await fetch(url, options);

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`TextClaw ${method} ${path} failed (${resp.status}): ${text}`);
  }

  return resp.json();
}

/**
 * Send a message via TextClaw relay → iMessage.
 * @param {string} _fromNumber - Ignored (TextClaw uses the shared BYOC number)
 * @param {string} toNumber - Recipient phone number (E.164)
 * @param {string} content - Message text
 * @param {string} [mediaUrl] - Optional media URL
 * @returns {Promise<object>}
 */
export async function sendMessage(_fromNumber, toNumber, content, mediaUrl = null) {
  const body = { to_number: toNumber, content };
  if (mediaUrl) {
    body.media_url = mediaUrl;
  }
  return request("POST", "/send/", body);
}

/**
 * Send a voice note via TextClaw relay → iMessage.
 * The server converts the audio to .caf format for inline iMessage playback.
 * @param {string} _fromNumber - Ignored
 * @param {string} toNumber - Recipient phone number (E.164)
 * @param {string} mediaUrl - URL to an audio file (mp3, wav, ogg, m4a, etc.)
 * @returns {Promise<object>}
 */
export async function sendVoiceNote(_fromNumber, toNumber, mediaUrl) {
  return request("POST", "/send/", {
    to_number: toNumber,
    content: "",
    media_url: mediaUrl,
    convert_to_voice_note: true,
  });
}

/**
 * Send typing indicator via TextClaw relay.
 * @param {string} _fromNumber - Ignored
 * @param {string} toNumber - Recipient phone number (E.164)
 */
export async function sendTypingIndicator(_fromNumber, toNumber) {
  return request("POST", "/typing/", { to_number: toNumber });
}

/**
 * Send a reaction (tapback) via TextClaw relay.
 * @param {string} _fromNumber - Ignored
 * @param {string} messageHandle - Apple GUID of the message to react to
 * @param {"heart"|"thumbsup"|"thumbsdown"|"laugh"|"emphasize"|"question"} reaction
 */
export async function sendReaction(_fromNumber, messageHandle, reaction) {
  return request("POST", "/reaction/", {
    message_handle: messageHandle,
    reaction,
  });
}

/**
 * Mark a conversation as read via TextClaw relay.
 * @param {string} toNumber - The phone number whose messages to mark as read
 */
export async function markRead(toNumber) {
  return request("POST", "/mark-read/", { to_number: toNumber });
}
