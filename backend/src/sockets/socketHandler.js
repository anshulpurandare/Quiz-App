const { generateQuiz } = require('../services/aiService');

// In-memory storage for rooms.
const rooms = {};

function initializeSocket(io) {
    io.on('connection', (socket) => {
        console.log(`User connected with socket ID: ${socket.id}`);

        // Keep 'create-room' and 'join-room' as they are...
        socket.on('create-room', (callback) => {
            const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            socket.join(roomCode);
            rooms[roomCode] = {
                hostId: socket.id,
                participants: [],
                quiz: null,
                scores: {}, // NEW: Object to store scores { socketId: score }
            };
            console.log(`Room [${roomCode}] created by host [${socket.id}]`);
            callback({ roomCode });
        });

        socket.on('join-room', ({ roomCode, name }, callback) => {
            if (rooms[roomCode]) {
                socket.join(roomCode);
                const newParticipant = { id: socket.id, name };
                rooms[roomCode].participants.push(newParticipant);
                io.to(roomCode).emit('update-participants', rooms[roomCode].participants);
                console.log(`User [${name}] joined room [${roomCode}]`);
                callback({ success: true, roomData: rooms[roomCode] });
            } else {
                callback({ success: false, message: 'Room not found.' });
            }
        });
        
        // Keep 'host-generate-quiz' and 'start-quiz' as they are...
        socket.on('host-generate-quiz', async (quizParams, callback) => {
            const { roomCode } = quizParams;
            if (rooms[roomCode] && rooms[roomCode].hostId === socket.id) {
                try {
                    const quizData = await generateQuiz(quizParams);
                    rooms[roomCode].quiz = quizData;
                    io.to(socket.id).emit('quiz-generated', quizData);
                    callback({ success: true });
                } catch (error) {
                    callback({ success: false, message: error.message });
                }
            }
        });

        socket.on('start-quiz', (roomCode) => {
            if (rooms[roomCode] && rooms[roomCode].hostId === socket.id) {
                const quiz = rooms[roomCode].quiz;
                if (quiz) {
                    io.to(roomCode).emit('quiz-started', quiz);
                }
            }
        });

        // --- NEW EVENT: A participant submits their final answers ---
        socket.on('submit-answers', ({ roomCode, score }) => {
            if (rooms[roomCode]) {
                rooms[roomCode].scores[socket.id] = score;

                // Check if all participants have submitted their scores
                const participantIds = rooms[roomCode].participants.map(p => p.id);
                const submittedIds = Object.keys(rooms[roomCode].scores);

                if (participantIds.every(id => submittedIds.includes(id))) {
                    // Everyone has finished, so let's compile the final leaderboard
                    const leaderboard = rooms[roomCode].participants.map(p => ({
                        name: p.name,
                        score: rooms[roomCode].scores[p.id] || 0
                    })).sort((a, b) => b.score - a.score); // Sort descending

                    // Broadcast the final results to everyone in the room
                    io.to(roomCode).emit('game-over', leaderboard);
                    console.log(`Game over in room [${roomCode}]. Broadcasting leaderboard.`);
                }
            }
        });

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);
            // Future logic: Remove user and handle game state if they disconnect mid-quiz
        });
    });
}

module.exports = initializeSocket;
