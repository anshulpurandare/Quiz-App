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
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Enable the server to parse JSON request bodies

// --- Server Initialization ---
// --- Server Initialization ---
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        // Provide an array of allowed origins
        origin: [
            "http://localhost:3000",              // For local development on the host machine
            "http://192.168.1.104:3000"           // For other devices on the network
        ],
        methods: ["GET", "POST"]
    }
});


// --- Route and Socket Initialization ---
app.use('/api', quizRoutes); // Use the REST API routes, prefixing them with /api
initializeSocket(io); // Set up all the real-time event listeners

// --- Health Check Endpoint ---
app.get('/', (req, res) => {
    res.send('Multiplayer Quiz Backend is running and healthy!');
});

// --- Start the Server ---
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
