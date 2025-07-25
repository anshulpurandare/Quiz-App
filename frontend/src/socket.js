import { io } from 'socket.io-client';

// Connect to your backend server
const URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';
export const socket = io(URL);
