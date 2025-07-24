import { io } from 'socket.io-client';

// Connect to your backend server
const URL = "http://localhost:4000";
export const socket = io(URL);
