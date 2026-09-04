import { io, type Socket } from "socket.io-client";
import { getToken } from "./client";

const API_URL: string = import.meta.env.VITE_API_URL || "http://localhost:3000";

// One shared connection for the whole app — pages join/leave map "rooms" on
// it rather than each opening (and re-authenticating) its own socket.
let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, {
      autoConnect: false,
      // Function form (not a plain object) so a reconnect always reads the
      // *current* token — logging out/in shouldn't require a page reload
      // for the socket to pick up the new one.
      auth: (cb) => cb({ token: getToken() }),
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
