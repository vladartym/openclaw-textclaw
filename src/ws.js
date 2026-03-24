/**
 * WebSocket client for receiving inbound iMessages from TextClaw.
 *
 * Instead of requiring a public URL for webhook delivery, the extension
 * maintains a persistent WebSocket connection to TextClaw. Messages are
 * pushed through this socket in real time — like Discord bot gateway.
 */

import { processInboundWebhook } from "./monitor.js";

let ws = null;
let wsUrl = null;
let reconnectDelay = 1000;
let reconnectTimer = null;
let pongTimer = null;

const MAX_RECONNECT_DELAY = 30000;
const PONG_INTERVAL = 30000;

/**
 * Start the WebSocket connection to TextClaw.
 * @param {string} url - WebSocket URL with api_key query param
 */
export function startWebSocket(url) {
  if (ws) return; // Already connected or connecting — prevent duplicates
  wsUrl = url;
  connect();
}

/**
 * Stop the WebSocket connection and clean up timers.
 */
export function stopWebSocket() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (pongTimer) clearInterval(pongTimer);
  if (ws) {
    ws.close(1000, "stopping");
    ws = null;
  }
}

function connect() {
  const maskedUrl = wsUrl.replace(/api_key=[^&]+/, "api_key=***");
  console.log(`[textclaw] WebSocket connecting to ${maskedUrl}`);

  ws = new WebSocket(wsUrl);

  ws.addEventListener("open", () => {
    console.log("[textclaw] WebSocket connected");
    reconnectDelay = 1000;
    startPong();
  });

  ws.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(event.data);
      handleMessage(data);
    } catch (err) {
      console.error("[textclaw] WebSocket message parse error:", err);
    }
  });

  ws.addEventListener("close", (event) => {
    console.log(`[textclaw] WebSocket closed: code=${event.code} reason=${event.reason}`);
    stopPong();
    ws = null;
    // 4010 = replaced by newer connection — don't reconnect
    if (event.code === 4010) {
      console.log("[textclaw] WebSocket replaced by newer connection, not reconnecting");
      return;
    }
    scheduleReconnect();
  });

  ws.addEventListener("error", (err) => {
    console.error("[textclaw] WebSocket error:", err.message || err);
  });
}

function handleMessage(data) {
  switch (data.type) {
    case "connection_ack":
      console.log(`[textclaw] WebSocket authenticated, account=${data.account_id}`);
      break;
    case "inbound_message":
      processInboundWebhook(data.payload).catch((err) => {
        console.error("[textclaw] inbound message processing error:", err);
      });
      break;
    case "ping":
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "pong" }));
      }
      break;
    default:
      console.log(`[textclaw] Unknown WebSocket message type: ${data.type}`);
  }
}

function scheduleReconnect() {
  const jitter = reconnectDelay * 0.25 * (Math.random() * 2 - 1);
  const delay = Math.min(reconnectDelay + jitter, MAX_RECONNECT_DELAY);

  console.log(`[textclaw] Reconnecting in ${Math.round(delay)}ms`);
  reconnectTimer = setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
    connect();
  }, delay);
}

function startPong() {
  pongTimer = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "pong" }));
    }
  }, PONG_INTERVAL);
}

function stopPong() {
  if (pongTimer) {
    clearInterval(pongTimer);
    pongTimer = null;
  }
}
