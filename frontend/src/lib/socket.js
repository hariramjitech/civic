import { io } from 'socket.io-client';

// import.meta.env.DEV is true when running `npm run dev`, false in production build
const SOCKET_URL = import.meta.env.DEV
  ? import.meta.env.VITE_SOCKET_URL_DEV   // → http://localhost:5000
  : import.meta.env.VITE_SOCKET_URL_PROD; // → https://civic-24jv.onrender.com

console.log(`🔌 Socket → ${SOCKET_URL}`);

let socket = null;

export const connectSocket = (userId) => {
  if (!socket && userId) {
    socket = io(SOCKET_URL, {
      auth: {
        userId,
      },
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
    console.log('🔌 Socket connection initialized for:', userId, '→', SOCKET_URL);
  }
  return socket;
};

export const getSocket = () => {
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    console.log('🔌 Socket disconnected');
    socket = null;
  }
};
