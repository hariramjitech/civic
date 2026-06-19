import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

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
    console.log('🔌 Socket connection initialized for:', userId);
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
