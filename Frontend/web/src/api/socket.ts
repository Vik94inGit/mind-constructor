import { io, type Socket } from "socket.io-client";
import { apiRequest } from "./client";

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
      // The session lives in the mc_sid cookie — withCredentials is what
      // makes the handshake carry it across this cross-site connection
      // where the browser allows that (see SOCKET_URL's own comment).
      withCredentials: true,
      // Safari never sends a third-party cookie, so the handshake also
      // carries a short-lived token fetched over the same-origin REST API,
      // where the cookie *is* sent (Backend's realtime/socketToken.ts).
      // Called on every connect and reconnect, so it's always fresh. A
      // failed fetch just connects without one — the cookie may still do.
      auth: (cb) => {
        apiRequest<{ token: string }>("/api/auth/socket-token")
          .then(({ token }) => cb({ token }))
          .catch(() => cb({}));
      },
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
