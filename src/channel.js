import * as api from "./api.js";
import { sendMessageToPeer, sendTyping, sendReactionToPeer, sendVoiceNoteToPeer, chunkText } from "./send.js";

/**
 * TextClaw iMessage channel plugin for OpenClaw.
 *
 * For BYOC (Bring Your Own Claw) users who subscribe to TextClaw's
 * iMessage relay service. No Mac required — messages route through
 * TextClaw's infrastructure which handles iMessage delivery.
 *
 * Outbound: sends messages, typing indicators, and reactions via TextClaw relay API.
 * Inbound: receives forwarded webhooks from TextClaw via WebSocket or HTTP route.
 */
const channelPlugin = {
  id: "textclaw",
  name: "TextClaw iMessage",
  description: "iMessage channel via TextClaw relay — no Mac required",

  meta: {
    id: "textclaw",
    label: "TextClaw (iMessage)",
    docsPath: "/channels/textclaw",
    blurb: "iMessage relay via TextClaw WebSocket bridge.",
    order: 100,
  },

  capabilities: {
    chatTypes: ["direct"],
  },

  // -- Config adapter --
  config: {
    listAccountIds(cfg) {
      return cfg.channels?.textclaw ? ["default"] : [];
    },
    resolveAccount(cfg, accountId) {
      return cfg.channels?.textclaw ?? {};
    },
  },

  // -- Gateway adapter --
  gateway: {
    startAccount(account, runtime) {
      api.configure(account.textclawUrl, account.apiKey);
      console.log(`[textclaw] gateway startAccount called — runtime type: ${typeof runtime}`, runtime ? Object.keys(runtime).join(', ') : 'undefined');
    },

    stopAccount(account) {
      console.log(`[textclaw] gateway account stopped`);
    },
  },

  // -- Outbound adapter --
  outbound: {
    async sendPayload(account, target, payload) {
      const peer = target.peer;
      const text = payload.text || "";
      const mediaUrl = payload.mediaUrl || null;

      if (!text && !mediaUrl) return;

      const chunks = chunkText(text);

      let lastResult = null;
      for (const chunk of chunks) {
        lastResult = await sendMessageToPeer(account, peer, chunk, {
          mediaUrl: chunks.indexOf(chunk) === 0 ? mediaUrl : null,
        });
      }

      return lastResult;
    },

    async sendTypingIndicator(account, target) {
      await sendTyping(account, target.peer);
    },
  },

  // -- Messaging adapter --
  messaging: {
    normalizeTarget(rawTarget) {
      return {
        peer: rawTarget.replace(/[^+\d]/g, ""),
        chatType: "dm",
      };
    },

    inferChatType(target) {
      return "dm";
    },

    getSessionKey(target) {
      return `textclaw:${target.peer}`;
    },
  },

  // -- Message actions --
  messageActions: {
    describeMessageTools() {
      return [
        {
          name: "react_imessage",
          description:
            "React to the last iMessage from the user with a tapback. " +
            "Available reactions: heart, thumbsup, thumbsdown, laugh, emphasize, question",
          parameters: {
            type: "object",
            properties: {
              reaction: {
                type: "string",
                enum: ["heart", "thumbsup", "thumbsdown", "laugh", "emphasize", "question"],
                description: "The tapback reaction type",
              },
            },
            required: ["reaction"],
          },
        },
        {
          name: "send_voice_note",
          description:
            "Send a voice note to the user via iMessage. Provide a URL to an audio file " +
            "(mp3, wav, ogg, m4a) — it will be converted to an iMessage-compatible voice note.",
          parameters: {
            type: "object",
            properties: {
              media_url: {
                type: "string",
                description: "URL to the audio file to send as a voice note",
              },
            },
            required: ["media_url"],
          },
        },
      ];
    },

    describeMessageTool() {
      return this.describeMessageTools();
    },

    async executeMessageTool(account, target, toolCall) {
      if (toolCall.name === "react_imessage") {
        await sendReactionToPeer(account, target.peer, toolCall.parameters.reaction);
        return { success: true };
      }
      if (toolCall.name === "send_voice_note") {
        const result = await sendVoiceNoteToPeer(account, target.peer, toolCall.parameters.media_url);
        return { success: true, messageId: result.messageId };
      }
      return { success: false, error: "Unknown tool" };
    },
  },

  // -- Typing config --
  typingMode: "instant",
  typingIntervalMs: 5000,
  maxChunkSize: 4000,
};

export default channelPlugin;
