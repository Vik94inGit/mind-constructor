import { io, type Socket } from "socket.io-client";

// Socket.IO's own absolute backend URL — deliberately *not* routed through
// vercel.json's /api/(.*) rewrite the way plain REST calls are. A Vercel
// rewrite to an external host doesn't reliably carry a WebSocket upgrade,
// so this connection stays genuinely cross-site to Render either way.
const SOCKET_URL: string = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || "http://localhost:3000";

// One shared connection for the whole app — pages join/leave map "rooms" on
// it rather than each opening (and re-authenticating) its own socket.
let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      // The session lives in the mc_sid cookie, not a client-supplied
      // credential — withCredentials is what makes the handshake's
      // polling/XHR requests actually carry it across this cross-site
      // connection (see SOCKET_URL's own comment).
      withCredentials: true,
    });
  }
  return socket;
}

export function joinMap(mapId: string) {
  const s = getSocket();
  if (!s.connected) s.connect();
  s.emit("join-map", mapId);
}

export function leaveMap(mapId: string) {
  if (socket?.connected) socket.emit("leave-map", mapId);
}

export { getSocket };
