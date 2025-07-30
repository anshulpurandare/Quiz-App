const { generateQuiz, generateSingleQuestion } = require('../services/aiService');

const rooms = {};

// This function handles the active game flow and remains unchanged.
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
            io.to(roomCode).emit('game-over', { leaderboard: finalLeaderboard, quizData: room.quiz, playerAnswers: room.playerAnswers });
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

    } else if (room.phase === 'question') {
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
            rooms[roomCode] = {
                hostId: socket.id,
                participants: [],
                quiz: null,
                scores: {},
                phase: 'lobby',
                quizParams: null,
            };
            if (callback && typeof callback === 'function') {
                callback({ roomCode });
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

        socket.on('host-generate-quiz', async (quizParams) => {
            const { roomCode } = quizParams;
            if (rooms[roomCode] && rooms[roomCode].hostId === socket.id) {
                try {
                    console.log(`Generating quiz for room ${roomCode}...`);
                    const quizData = await generateQuiz(quizParams);
                    const room = rooms[roomCode];
                    room.quiz = quizData;
                    room.quizParams = quizParams;
                    room.phase = 'review';
                    socket.emit('quiz-review-data', quizData);
                    console.log(`Quiz for room ${roomCode} sent to host for review.`);
                } catch (error) {
                    console.error('Error generating quiz:', error.message);
                    socket.emit('error', { message: `Quiz Generation Failed: ${error.message}` });
                }
            }
        });
        
        // [FIXED] This handler now correctly performs the regeneration logic.
        socket.on('host-regenerate-quiz', async ({ roomCode }) => {
            const room = rooms[roomCode];
            if (room && room.hostId === socket.id && room.quizParams) {
                console.log(`Host requested FULL quiz regeneration for room ${roomCode}.`);
                try {
                    // Directly call the quiz generation service again.
                    const newQuizData = await generateQuiz(room.quizParams);
                    room.quiz = newQuizData; // Replace the old quiz with the new one
                    
                    // Emit the same event the frontend is already listening for, sending the new data.
                    socket.emit('quiz-review-data', newQuizData);
                    console.log(`Full quiz for room ${roomCode} regenerated and sent to host.`);
                } catch (error) {
                    console.error(`Error regenerating full quiz for room ${roomCode}:`, error.message);
                    socket.emit('error', { message: `Quiz Regeneration Failed: ${error.message}` });
                }
            } else {
                socket.emit('error', { message: 'Could not regenerate quiz. Original parameters not found.' });
            }
        });

        socket.on('host-update-quiz', ({ roomCode, updatedQuiz }) => {
            const room = rooms[roomCode];
            if (room && room.hostId === socket.id) {
                room.quiz = updatedQuiz;
                console.log(`Quiz for room ${roomCode} was updated by the host.`);
                socket.emit('quiz-update-ack', { success: true });
            }
        });

        socket.on('host-regenerate-single-question', async ({ roomCode, questionIndex }) => {
            const room = rooms[roomCode];
            if (room && room.hostId === socket.id && room.quizParams && typeof questionIndex === 'number' && room.quiz && questionIndex < room.quiz.length) {
                console.log(`Host requested regeneration of question ${questionIndex} for room ${roomCode}.`);
                try {
                    const newQuestion = await generateSingleQuestion(room.quizParams, questionIndex);
                    if (newQuestion) {
                        room.quiz[questionIndex] = newQuestion;
                        socket.emit('single-question-updated', { questionIndex, newQuestion });
                        console.log(`Question ${questionIndex} for room ${roomCode} regenerated successfully.`);
                    } else {
                        socket.emit('error', { message: 'Failed to generate a valid question.' });
                    }
                } catch (error) {
                    console.error(`Error regenerating question ${questionIndex} for room ${roomCode}:`, error.message);
                    socket.emit('error', { message: `Failed to regenerate question: ${error.message}` });
                }
            }
        });

        socket.on('start-quiz', ({ roomCode, timerDuration }) => {
            const room = rooms[roomCode];
            if (room && room.quiz && room.hostId === socket.id) {
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
        
// This code should be placed within the io.on('connection', (socket) => { ... }); block

// --- ALL OTHER EVENT HANDLERS (create-room, join-room, etc.) REMAIN UNCHANGED ---

// Handles a participant submitting an answer for the current question
socket.on('submit-answer', ({ roomCode, questionIndex, answer }) => {
    const room = rooms[roomCode];
    // Extensive validation to ensure the game is in a valid state for an answer
    if (room && room.phase === 'question' && room.quiz && room.quiz[questionIndex] && !room.answeredThisRound.includes(socket.id)) {
        
        // Record that this user has answered to prevent multiple submissions
        room.answeredThisRound.push(socket.id);

        // Update the distribution chart data for the host's live view
        if (!room.answerDistribution[answer]) {
            room.answerDistribution[answer] = 0;
        }
        room.answerDistribution[answer]++;

        // Check if the answer is correct and update the score
        const isCorrect = room.quiz[questionIndex].correctAnswer === answer;
        if (isCorrect) {
            if (!room.scores[socket.id]) { room.scores[socket.id] = 0; }
            room.scores[socket.id]++;
        }

        // Store the player's answer for the final review screen
        if (room.playerAnswers && room.playerAnswers[socket.id]) {
            room.playerAnswers[socket.id][questionIndex] = answer;
        }

        // Send updated live data to the host
        io.to(room.hostId).emit('host-update', {
            answeredThisRound: room.answeredThisRound,
            answerDistribution: room.answerDistribution
        });

        // Send progress update to all clients in the room
        io.to(roomCode).emit('update-answer-progress', {
            answeredCount: room.answeredThisRound.length,
            totalParticipants: room.participants.length
        });
    }
});

// Handles the host's action to skip the current question timer
socket.on('host-skip-question', (roomCode) => {
    const room = rooms[roomCode];
    if (room && room.hostId === socket.id && room.phase === 'question') {
        console.log(`Host in room [${roomCode}] skipped the question.`);
        // Calling advanceGame from the 'question' phase transitions it to 'results'
        advanceGame(io, roomCode);
    }
});

// Handles the host's action to end the entire quiz prematurely
socket.on('host-end-quiz', (roomCode) => {
    const room = rooms[roomCode];
    if (room && room.hostId === socket.id) {
        console.log(`Host in room [${roomCode}] ended the quiz for everyone.`);
        
        // Stop any active timers to prevent further state changes
        if (room.timer) clearInterval(room.timer);

        // Compile and send the final leaderboard and results
        const finalLeaderboard = room.participants.map(p => ({
            name: p.name, score: room.scores[p.id] || 0
        })).sort((a, b) => b.score - a.score);

        io.to(roomCode).emit('game-over', { leaderboard: finalLeaderboard, quizData: room.quiz, playerAnswers: room.playerAnswers });
    }
});

// Handles any user disconnecting from the socket
socket.on('disconnect', () => {
    console.log(`User disconnected with socket ID: ${socket.id}`);
    const disconnectedSocketId = socket.id;

    // Find which room, if any, the disconnected user was in
    const roomCode = Object.keys(rooms).find(key => {
        const room = rooms[key];
        const isParticipant = room.participants.some(p => p.id === disconnectedSocketId);
        return room.hostId === disconnectedSocketId || isParticipant;
    });

    if (!roomCode) {
        return; // The user was not in an active room
    }

    const room = rooms[roomCode];

    // Case 1: The Host disconnected. The game ends for everyone.
    if (room.hostId === disconnectedSocketId) {
        console.log(`Host disconnected from room [${roomCode}]. Ending game.`);
        if (room.timer) clearInterval(room.timer);
        
        // Notify all remaining clients that the host has left
        io.to(roomCode).emit('host-disconnected');
        
        // Clean up the room from memory
        delete rooms[roomCode];
    } 
    // Case 2: A Participant disconnected. The game continues.
    else {
        const participantIndex = room.participants.findIndex(p => p.id === disconnectedSocketId);
        if (participantIndex !== -1) {
            console.log(`Participant "${room.participants[participantIndex].name}" disconnected from room [${roomCode}].`);
            
            // Remove the participant from the roster
            room.participants.splice(participantIndex, 1);
            
            // Broadcast the updated participant list to everyone still in the room
            io.to(roomCode).emit('update-participants', room.participants);

            // If a quiz question was in progress, update the live answer progress
            if (room.phase === 'question') {
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

module.exports = initializeSocket;
