import { io } from 'socket.io-client';

// Connect to your backend server
const URL = "http://192.168.1.104:4000";
export const socket = io(URL);
