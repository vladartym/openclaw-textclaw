import { recordInboundSessionAndDispatchReply } from "openclaw/plugin-sdk/compat";
import { storeHandle } from "./handle-store.js";
import { getPluginApi } from "./runtime.js";
import { sendMessageToPeer, chunkText } from "./send.js";

// Per-peer buffer for aggregating response blocks before sending
const deliverBuffers = new Map();
const DELIVER_DEBOUNCE_MS = 1500;

/**
 * Handle an inbound webhook forwarded from TextClaw.
 *
 * TextClaw receives inbound message webhooks and forwards them either
 * via WebSocket or HTTP POST to /ext/textclaw/inbound.
 *
 * @param {object} payload - Inbound message payload (forwarded by TextClaw)
 */
export async function processInboundWebhook(payload) {
  const eventType = payload.type || detectEventType(payload);

  switch (eventType) {
    case "receive":
      return handleInboundMessage(payload);
    case "typing_indicator":
      console.log(`[textclaw] inbound typing from ${payload.from_number || payload.number}`);
      return;
    case "reaction":
      console.log(`[textclaw] inbound reaction from ${payload.from_number || payload.number}`);
      return;
    default:
      console.log(`[textclaw] ignoring webhook event type: ${eventType}`);
  }
}

function detectEventType(payload) {
  if (payload.content !== undefined || payload.media_url) return "receive";
  if (payload.reaction) return "reaction";
  if (payload.is_typing !== undefined) return "typing_indicator";
  return "unknown";
}

/**
 * Flush buffered response blocks for a peer as a single combined message.
 */
async function flushDeliverBuffer(account, peer) {
  const buf = deliverBuffers.get(peer);
  if (!buf) return;
  deliverBuffers.delete(peer);

  const combined = buf.texts.join("\n\n");
  const mediaUrl = buf.media;

  if (combined || mediaUrl) {
    const chunks = chunkText(combined);
    for (const chunk of chunks) {
      await sendMessageToPeer(account, peer, chunk, {
        mediaUrl: chunks.indexOf(chunk) === 0 ? mediaUrl : null,
      });
    }
  }
}

async function handleInboundMessage(payload) {
  const api = getPluginApi();
  const runtime = api.runtime;
  const cfg = api.config;
  const account = api.pluginConfig;

  const peer = payload.from_number || payload.number;
  const messageHandle = payload.message_handle;
  const text = payload.content || "";
  const mediaUrl = payload.media_url || undefined;

  if (messageHandle) {
    storeHandle(peer, messageHandle, "inbound");
  }

  const sessionKey = `textclaw:${peer}`;

  console.log(`[textclaw] dispatching inbound from ${peer}: "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"`);

  try {
    await recordInboundSessionAndDispatchReply({
      cfg,
      channel: "textclaw",
      accountId: "default",
      agentId: "main",
      routeSessionKey: sessionKey,
      storePath: runtime.state.resolveStateDir() + "/sessions/textclaw-sessions.json",
      ctxPayload: {
        Body: text,
        From: `textclaw:${peer}`,
        To: "textclaw:default",
        SessionKey: sessionKey,
        AccountId: "default",
        ChatType: "direct",
        SenderName: peer,
        SenderId: peer,
        Provider: "textclaw",
        Surface: "textclaw",
        WasMentioned: true,
        MessageSid: messageHandle || "",
        Timestamp: payload.date_sent || new Date().toISOString(),
        MediaUrl: mediaUrl,
      },
      recordInboundSession: runtime.channel.session.recordInboundSession,
      dispatchReplyWithBufferedBlockDispatcher: runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher,
      deliver: async (replyPayload) => {
        const replyText = replyPayload.Body || replyPayload.text || "";
        const replyMedia = replyPayload.MediaUrl || replyPayload.mediaUrl || null;

        // Buffer response blocks and debounce — send combined after 1.5s of no new blocks
        if (!deliverBuffers.has(peer)) {
          deliverBuffers.set(peer, { texts: [], media: null, timer: null });
        }
        const buf = deliverBuffers.get(peer);
        if (replyText) buf.texts.push(replyText);
        if (replyMedia) buf.media = replyMedia;

        clearTimeout(buf.timer);
        buf.timer = setTimeout(() => {
          flushDeliverBuffer(account, peer).catch((err) => {
            console.error("[textclaw] deliver flush error:", err);
          });
        }, DELIVER_DEBOUNCE_MS);
      },
      onRecordError: (err) => console.error("[textclaw] session record error:", err),
      onDispatchError: (err) => console.error("[textclaw] dispatch error:", err),
      replyOptions: {},
    });
  } catch (err) {
    console.error("[textclaw] inbound dispatch failed:", err);
  }
}
