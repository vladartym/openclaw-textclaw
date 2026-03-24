# @textopenclaw/textclaw

iMessage channel plugin for [OpenClaw](https://github.com/openclaw/openclaw) via [TextClaw](https://textclaw.now) relay. No Mac required.

```
Your OpenClaw --> TextClaw Relay API --> iMessage
```

## Quick Start

1. **Get an API key** from [textclaw.now](https://textclaw.now) (sign up, then grab your BYOC key from the dashboard)
2. **Install the plugin:**
   ```bash
   openclaw plugins install @textopenclaw/textclaw
   ```
3. **Add to your channel config:**
   ```json
   {
     "textclaw": {
       "enabled": true,
       "textclawUrl": "https://textclaw.now",
       "apiKey": "YOUR_API_KEY"
     }
   }
   ```
4. **Done.** Messages arrive via WebSocket automatically. No public URL needed.

## Configuration

| Field | Required | Description |
|-------|----------|-------------|
| `enabled` | No | Enable/disable the channel (default: `false`) |
| `textclawUrl` | Yes | TextClaw API base URL |
| `apiKey` | Yes | Your BYOC API key from TextClaw |
| `dmPolicy` | No | `"open"`, `"allowlist"`, `"pairing"`, or `"disabled"` (default: `"open"`) |
| `allowFrom` | No | Phone numbers allowed to DM when using `"allowlist"` policy |

## Features

- Send and receive iMessages (text + media)
- Typing indicators
- Tapback reactions: heart, thumbsup, thumbsdown, laugh, emphasize, question
- Message chunking for long texts (4000 char limit per message)
- WebSocket connection for real-time inbound message delivery

## How It Works

1. **Outbound**: OpenClaw calls the TextClaw relay API, which forwards the message to iMessage.
2. **Inbound**: TextClaw receives inbound message webhooks, matches them to your account, and pushes messages to your OpenClaw instance via WebSocket (with HTTP fallback if you provide an `openclaw_url` during registration).

## Setup for AI Agents

If you're an OpenClaw instance configuring iMessage support, here's everything you need:

**You were given a TextClaw API key** (64-character hex string from textclaw.now).

Install the plugin:
```bash
openclaw plugins install @textopenclaw/textclaw
```

Add this to your channel config:
```json
{
  "textclaw": {
    "enabled": true,
    "textclawUrl": "https://textclaw.now",
    "apiKey": "YOUR_API_KEY"
  }
}
```

That's it. The plugin connects to TextClaw via WebSocket automatically. No public URL, no port forwarding, no extra setup. Messages flow through TextClaw's relay to iMessage and back.

## License

MIT
