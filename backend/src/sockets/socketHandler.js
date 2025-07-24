const { generateQuiz } = require('../services/aiService');

const rooms = {};

// --- A NEW, UNIFIED GAME LOOP FUNCTION ---
// This single function now controls all game state transitions.
function advanceGame(io, roomCode) {
    const room = rooms[roomCode];
    if (!room || !room.quiz) return;

    // Clear any existing timers to prevent duplicates and ghost timers.
    if (room.timer) clearInterval(room.timer);

    // If the last phase was showing results, it's time for the next question.
    if (room.phase === 'results') {
        room.currentQuestionIndex++;
        const questionIndex = room.currentQuestionIndex;
        const question = room.quiz[questionIndex];

        // If there are no more questions, end the game.
        if (!question) {
            const finalLeaderboard = room.participants.map(p => ({
                name: p.name,
                score: room.scores[p.id] || 0
            })).sort((a, b) => b.score - a.score);
            io.to(roomCode).emit('game-over', { leaderboard: finalLeaderboard, quizData: room.quiz });
            return;
        }

        // Otherwise, start the new question phase.
        room.phase = 'question';
        io.to(roomCode).emit('new-question', {
            question: question.question,
            options: question.options,
            questionIndex: questionIndex,
            totalQuestions: room.quiz.length,
        });

        // Start the timer for this new question.
        let remainingTime = room.timerDuration;
        room.timer = setInterval(() => {
            io.to(roomCode).emit('timer-tick', { remainingTime });
            remainingTime--;
            if (remainingTime < 0) {
                // When time is up, call this same function to advance to the results phase.
                advanceGame(io, roomCode);
            }
        }, 1000);

    } 
    // If the last phase was a question, it's now time to show the results.
    else if (room.phase === 'question') {
        room.phase = 'results';
        const questionIndex = room.currentQuestionIndex;
        const correctAnswer = room.quiz[questionIndex].correctAnswer;

        // Broadcast the live leaderboard and the correct answer.
        const leaderboard = room.participants.map(p => ({
            name: p.name,
            score: room.scores[p.id] || 0
        })).sort((a, b) => b.score - a.score);
        io.to(roomCode).emit('update-leaderboard', leaderboard);
        io.to(roomCode).emit('question-over', { correctAnswer });

        // Wait 5 seconds, then call this same function to advance to the next question.
        setTimeout(() => advanceGame(io, roomCode), 5000);
    }
}

function initializeSocket(io) {
    io.on('connection', (socket) => {
        console.log(`User connected with socket ID: ${socket.id}`);

        socket.on('create-room', (callback) => {
            const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            socket.join(roomCode);
            rooms[roomCode] = { hostId: socket.id, participants: [], quiz: null, scores: {} };
            callback({ roomCode });
        });

        socket.on('join-room', ({ roomCode, name }, callback) => {
            if (rooms[roomCode]) {
                socket.join(roomCode);
                const newParticipant = { id: socket.id, name };
                rooms[roomCode].participants.push(newParticipant);
                io.to(roomCode).emit('update-participants', rooms[roomCode].participants);
                callback({ success: true, roomData: rooms[roomCode] });
            } else {
                callback({ success: false, message: 'Room not found.' });
            }
        });
        
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

        // --- THE CORRECTED 'start-quiz' HANDLER ---
        // This is now much simpler and only kicks off the game loop.
        socket.on('start-quiz', ({ roomCode, timerDuration }) => {
            const room = rooms[roomCode];
            if (room && room.quiz && room.hostId === socket.id) {
                // Initialize the game state.
                room.currentQuestionIndex = -1; // Start at -1 so the first advance call sets it to 0.
                room.scores = {};
                room.timerDuration = timerDuration || 15;
                room.phase = 'results'; // Set initial phase so the first advance call starts a question.

                // Kick off the unified game loop for the very first time.
                advanceGame(io, roomCode);
            }
        });

        socket.on('submit-answer', ({ roomCode, questionIndex, answer }) => {
            const room = rooms[roomCode];
            if (room && room.quiz && room.quiz[questionIndex]) {
                const isCorrect = room.quiz[questionIndex].correctAnswer === answer;
                if (isCorrect) {
                    if (!room.scores[socket.id]) { room.scores[socket.id] = 0; }
                    room.scores[socket.id]++;
                }
            }
        });
        
        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);
        });
    });
}
module.exports = initializeSocket;
