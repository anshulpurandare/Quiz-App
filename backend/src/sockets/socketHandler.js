const { generateQuiz } = require('../services/aiService');

const rooms = {};

function advanceGame(io, roomCode) {
    const room = rooms[roomCode];
    if (!room || !room.quiz) return;

    if (room.timer) clearInterval(room.timer);

    if (room.phase === 'results') {
        room.answeredThisRound = [];
        room.answerDistribution = {};
        room.currentQuestionIndex++;
        const questionIndex = room.currentQuestionIndex;
        const question = room.quiz[questionIndex];

        if (!question) {
            const finalLeaderboard = room.participants.map(p => ({
                name: p.name,
                score: room.scores[p.id] || 0
            })).sort((a, b) => b.score - a.score);
            io.to(roomCode).emit('game-over', { leaderboard: finalLeaderboard, quizData: room.quiz,playerAnswers: room.playerAnswers });
            return;
        }

        room.phase = 'question';
        io.to(roomCode).emit('new-question', {
            question: question.question,
            options: question.options,
            questionIndex: questionIndex,
            totalQuestions: room.quiz.length,
        });

        let remainingTime = room.timerDuration;
        room.timer = setInterval(() => {
            io.to(roomCode).emit('timer-tick', { remainingTime });
            remainingTime--;
            if (remainingTime < 0) {
                advanceGame(io, roomCode);
            }
        }, 1000);

    } 
    else if (room.phase === 'question') {
        room.phase = 'results';
        const questionIndex = room.currentQuestionIndex;
        const correctAnswer = room.quiz[questionIndex].correctAnswer;

        const leaderboard = room.participants.map(p => ({
            name: p.name,
            score: room.scores[p.id] || 0
        })).sort((a, b) => b.score - a.score);
        io.to(roomCode).emit('update-leaderboard', leaderboard);
        room.participants.forEach(p => {
            const theirAnswer = room.playerAnswers[p.id]?.[questionIndex] || "No Answer";
            io.to(p.id).emit('question-over', { 
                correctAnswer: correctAnswer,
                yourAnswer: theirAnswer 
            });
        });
        io.to(room.hostId).emit('question-over', {
            correctAnswer: correctAnswer,
            yourAnswer: null 
        });

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
            // Only execute the callback if it was actually provided.
            if (callback && typeof callback === 'function') {
                callback({ roomCode });
            } else {
                // This log helps with debugging if it happens again.
                console.log(`Client ${socket.id} created room ${roomCode} but provided no callback.`);
            }
        });

        socket.on('join-room', ({ roomCode, name }, callback) => {
            if (rooms[roomCode]) {
                socket.join(roomCode);
                const newParticipant = { id: socket.id, name };
                rooms[roomCode].participants.push(newParticipant);
                if (rooms[roomCode].playerAnswers) {
                    rooms[roomCode].playerAnswers[socket.id] = [];
                }
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


        socket.on('start-quiz', ({ roomCode, timerDuration }) => {
            const room = rooms[roomCode];
            if (room && room.quiz && room.hostId === socket.id) {
                // Initialize the game state
                room.currentQuestionIndex = -1;
                room.scores = {};
                room.timerDuration = timerDuration || 15;
                room.phase = 'results';
                room.answeredThisRound = [];
                room.answerDistribution = {}; 
                room.playerAnswers = {};
                room.participants.forEach(p => {
                    room.playerAnswers[p.id] = [];
                });
                room.playerAnswers[room.hostId] = [];   
                advanceGame(io, roomCode);
            }
        });

        socket.on('submit-answer', ({ roomCode, questionIndex, answer }) => {
            const room = rooms[roomCode];
            if (room && room.quiz && room.quiz[questionIndex] && !room.answeredThisRound.includes(socket.id)) {
                room.answeredThisRound.push(socket.id);
                if (!room.answerDistribution[answer]) {
                    room.answerDistribution[answer] = 0;
                }
                room.answerDistribution[answer]++;
                const isCorrect = room.quiz[questionIndex].correctAnswer === answer;
                if (isCorrect) {
                    if (!room.scores[socket.id]) { room.scores[socket.id] = 0; }
                    room.scores[socket.id]++;
                }
                if (room.playerAnswers && room.playerAnswers[socket.id]) {
                    room.playerAnswers[socket.id][questionIndex] = answer;
                }
                // Notify the host about the new submission
                io.to(room.hostId).emit('host-update', {
                    answeredThisRound: room.answeredThisRound,
                    answerDistribution: room.answerDistribution
                });
                 io.to(roomCode).emit('update-answer-progress', {
                    answeredCount: room.answeredThisRound.length,
                    totalParticipants: room.participants.length
                });
            }
        });
        
        socket.on('host-skip-question', (roomCode) => {
            const room = rooms[roomCode];
            if (room && room.hostId === socket.id) {
                console.log(`Host skipped question in room [${roomCode}]`);
                // Advancing the game from a 'question' phase moves it to 'results'
                if (room.phase === 'question') {
                    advanceGame(io, roomCode);
                }
            }
        });

        socket.on('host-end-quiz', (roomCode) => {
            const room = rooms[roomCode];
            if (room && room.hostId === socket.id) {
                console.log(`Host ended quiz in room [${roomCode}]`);
                
                if (room.timer) clearInterval(room.timer);
                const finalLeaderboard = room.participants.map(p => ({
                    name: p.name, score: room.scores[p.id] || 0
                })).sort((a, b) => b.score - a.score);
                io.to(roomCode).emit('game-over', { leaderboard: finalLeaderboard, quizData: room.quiz });
            }
        });
        
        socket.on('disconnect', () => {
            console.log(`User disconnected with socket ID: ${socket.id}`);
            const disconnectedSocketId = socket.id;

            // Find the room the disconnected user was in.
            const roomCode = Object.keys(rooms).find(key => {
                const room = rooms[key];
                const isParticipant = room.participants.some(p => p.id === disconnectedSocketId);
                return room.hostId === disconnectedSocketId || isParticipant;
            });

            if (!roomCode) {
                console.log(`Disconnected user ${disconnectedSocketId} was not in any active room.`);
                return;
            }

            const room = rooms[roomCode];

            // --- THIS IS THE LOGIC WE ARE IMPLEMENTING ---
            // Case 1: The Host disconnected. The game ends.
            if (room.hostId === disconnectedSocketId) {
                console.log(`Host disconnected from room [${roomCode}]. Ending game for all.`);
                
                // Notify all remaining clients that the host left and the game is over.
                io.to(roomCode).emit('host-disconnected');

                // Clean up the room from memory.
                if (room.timer) clearInterval(room.timer);
                delete rooms[roomCode];
            } 
            // Case 2: A Participant disconnected.
            else {
                const participantIndex = room.participants.findIndex(p => p.id === disconnectedSocketId);
                if (participantIndex !== -1) {
                    const participantName = room.participants[participantIndex].name;
                    console.log(`Participant "${participantName}" disconnected from room [${roomCode}].`);

                    // Remove the participant from the list.
                    room.participants.splice(participantIndex, 1);
                    
                    // Broadcast the updated participant list to everyone in the room.
                    io.to(roomCode).emit('update-participants', room.participants);

                    // If a quiz is in progress, update the live progress indicators.
                    if (room.phase === 'question') {
                        const answeredIndex = room.answeredThisRound.indexOf(disconnectedSocketId);
                        if (answeredIndex > -1) {
                            room.answeredThisRound.splice(answeredIndex, 1);
                        }

                        io.to(room.hostId).emit('host-update', {
                            answeredThisRound: room.answeredThisRound,
                            answerDistribution: room.answerDistribution
                        });
                        
                        io.to(roomCode).emit('update-answer-progress', {
                            answeredCount: room.answeredThisRound.length,
                            totalParticipants: room.participants.length
                        });
                    }
                }
            }
        });

    });
}
// Add this to the top of the advanceGame function
// if (room.phase === 'results') { room.answeredThisRound = []; ... }
module.exports = initializeSocket;

