/**
 * SafeGuard AI - Real-time Hardware WebSocket Client
 * Connects to /ws/hardware for sub-second digital twin state updates.
 */

class HardwareWebSocketClient {
  constructor() {
    this.ws = null;
    this.subscribers = new Set();
    this.statusSubscribers = new Set();
    this.isConnected = false;
    this.reconnectTimer = null;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    let wsUrl;
    if (import.meta.env.VITE_WS_URL) {
      wsUrl = import.meta.env.VITE_WS_URL;
    } else if (import.meta.env.VITE_API_BASE_URL) {
      try {
        const u = new URL(import.meta.env.VITE_API_BASE_URL, window.location.origin);
        const proto = u.protocol === "https:" ? "wss:" : "ws:";
        wsUrl = `${proto}//${u.host}/ws/hardware`;
      } catch {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        wsUrl = `${protocol}//${window.location.host}/ws/hardware`;
      }
    } else {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      wsUrl = `${protocol}//${host}/ws/hardware`;
    }

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.notifyStatus(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const state = JSON.parse(event.data);
          this.notifyState(state);
        } catch {
          // Non-JSON ping/pong or telemetry
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.notifyStatus(false);
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.isConnected = false;
        this.notifyStatus(false);
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 3000);
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  subscribeStatus(callback) {
    this.statusSubscribers.add(callback);
    callback(this.isConnected);
    return () => this.statusSubscribers.delete(callback);
  }

  notifyState(state) {
    this.subscribers.forEach((cb) => {
      try {
        cb(state);
      } catch (e) {
        console.error("Hardware WS subscriber error:", e);
      }
    });
  }

  notifyStatus(status) {
    this.statusSubscribers.forEach((cb) => {
      try {
        cb(status);
      } catch (e) {
        console.error("Hardware WS status subscriber error:", e);
      }
    });
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}

export const hardwareWs = new HardwareWebSocketClient();
