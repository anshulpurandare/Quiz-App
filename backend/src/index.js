require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors'); 
const initializeSocket = require('./sockets/socketHandler');
const uploadQuizRoute = require('./api/uploadQuiz.js');


const app = express();
const server = http.createServer(app);

const corsOptions = {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
};

app.use(cors(corsOptions));
app.use(express.json());

app.use('/api/upload-quiz', uploadQuizRoute);

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
