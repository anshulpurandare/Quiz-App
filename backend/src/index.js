require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// Import our refactored modules
const quizRoutes = require('./api/quizRoutes');
const initializeSocket = require('./sockets/socketHandler');

const app = express();

// --- Middleware Setup ---
app.use(cors()); 
app.use(express.json());

// --- Server Initialization ---
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        // Only allow connections from the local React development server
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// --- Route and Socket Initialization ---
app.use('/api', quizRoutes); 
initializeSocket(io); 

// --- Health Check Endpoint ---
app.get('/', (req, res) => {
    res.send('Multiplayer Quiz Backend is running and healthy!');
});

// --- Start the Server for Local Development ---
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
