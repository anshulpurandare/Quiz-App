require('dotenv').config(); // Make sure dotenv is installed
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors'); // Make sure cors is installed
const initializeSocket = require('./sockets/socketHandler');


const app = express();
const server = http.createServer(app);

const corsOptions = {
    origin: process.env.FRONTEND_URL || "http://localhost:3000", // Allow dev and production
    methods: ["GET", "POST"]
};

app.use(cors(corsOptions));

const io = new Server(server, {
    cors: corsOptions 
});

initializeSocket(io);
app.get('/', (req, res) => {
    res.send('Server is running');
});
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
