import channelPlugin from "./src/channel.js";
import { processInboundWebhook } from "./src/monitor.js";
import { startWebSocket, stopWebSocket } from "./src/ws.js";
import { setPluginApi } from "./src/runtime.js";
import * as api from "./src/api.js";

let registered = false;

const plugin = {
  id: "textclaw",
  name: "TextClaw iMessage",
  description: "iMessage channel via TextClaw relay — no Mac required",

  register(pluginApi) {
    if (registered) return;
    registered = true;

    // Store pluginApi for runtime access (config, runtime.channel, etc.)
    setPluginApi(pluginApi);

    const account = pluginApi.pluginConfig;

    // Configure API client
    api.configure(account.textclawUrl, account.apiKey);

    // Register the channel
    pluginApi.registerChannel({ plugin: channelPlugin });

    // Start WebSocket for inbound messages
    const wsBase = account.textclawUrl
      .replace(/^http:/, "ws:")
      .replace(/^https:/, "wss:")
      .replace(/\/+$/, "");
    const wsUrl = `${wsBase}/ws/byoc/inbound/?api_key=${account.apiKey}`;
    startWebSocket(wsUrl);

    // Inbound webhook route (HTTP fallback)
    pluginApi.registerHttpRoute({
      path: "/ext/textclaw/inbound",
      auth: "plugin",
      handler: async (req, res) => {
        try {
          await processInboundWebhook(req.body);
          res.statusCode = 200;
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          console.error("[textclaw] webhook error:", err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
        return true;
      },
    });

    // Status check route
    pluginApi.registerHttpRoute({
      path: "/ext/textclaw/status",
      auth: "plugin",
      handler: async (req, res) => {
        const configuredKey = api.getApiKey();
        const checkKey = req.headers["x-api-key"] || "";
        res.statusCode = 200;
        res.end(JSON.stringify({
          installed: true,
          version: "0.4.3",
          keyMatch: !!(checkKey && checkKey === configuredKey),
        }));
        return true;
      },
    });

    pluginApi.onShutdown?.(() => stopWebSocket());

    console.log(`[textclaw] channel started — relay via ${account.textclawUrl}`);
  },
};

export default plugin;
