import { io } from "socket.io-client";

const SOCKET_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

let socket = null;
const joinedOrgs = new Set();

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    // Re-join all org rooms after reconnection
    socket.on("connect", () => {
      joinedOrgs.forEach((orgId) => {
        socket.emit("joinOrg", orgId);
      });
    });
  }
  return socket;
};

export const connectToOrg = (orgId) => {
  const s = getSocket();
  joinedOrgs.add(orgId);
  if (!s.connected) s.connect();
  else s.emit("joinOrg", orgId);
  return s;
};

export const disconnectFromOrg = (orgId) => {
  const s = getSocket();
  joinedOrgs.delete(orgId);
  s.emit("leaveOrg", orgId);
};

export default getSocket;
