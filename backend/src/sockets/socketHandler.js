const { generateQuiz, generateSingleQuestion } = require('../services/aiService');

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
                score: room.scores[p.id] || 0,
            })).sort((a, b) => b.score - a.score);

            io.to(roomCode).emit('game-over', {
                leaderboard: finalLeaderboard,
                quizData: room.quiz,
                playerAnswers: room.playerAnswers,
            });
            return;
        }

        room.phase = 'question';
        io.to(roomCode).emit('new-question', {
            question: question.question,
            options: question.options,
            questionIndex,
            totalQuestions: room.quiz.length,
        });

        let remainingTime = room.timerDuration || 15;
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
            score: room.scores[p.id] || 0,
        })).sort((a, b) => b.score - a.score);

        io.to(roomCode).emit('update-leaderboard', leaderboard);

        room.participants.forEach(p => {
            const theirAnswer = room.playerAnswers[p.id]?.[questionIndex] || "No Answer";
            io.to(p.id).emit('question-over', {
                correctAnswer,
                yourAnswer: theirAnswer,
            });
        });

        io.to(room.hostId).emit('question-over', {
            correctAnswer,
            yourAnswer: null,
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
                currentQuestionIndex: -1,
                timerDuration: 15,
                answeredThisRound: [],
                answerDistribution: {},
                playerAnswers: {},
            };
            if (typeof callback === 'function') {
                callback({ roomCode });
            } else {
                console.log(`Client ${socket.id} created room ${roomCode} without callback.`);
            }
        });

        socket.on('join-room', ({ roomCode, name }, callback) => {
            const room = rooms[roomCode];
            if (room) {
                socket.join(roomCode);
                const newParticipant = { id: socket.id, name };
                room.participants.push(newParticipant);
                if (room.playerAnswers) {
                    room.playerAnswers[socket.id] = [];
                }
                io.to(roomCode).emit('update-participants', room.participants);
                if (typeof callback === 'function') {
                    callback({ success: true, roomData: room });
                }
            } else {
                if (typeof callback === 'function') {
                    callback({ success: false, message: 'Room not found.' });
                }
            }
        });

        socket.on('host-generate-quiz', async (quizParams) => {
            const { roomCode } = quizParams;
            const room = rooms[roomCode];
            if (room && room.hostId === socket.id) {
                try {
                    console.log(`Generating quiz for room ${roomCode}...`);
                    const quizData = await generateQuiz(quizParams);
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
        socket.on('host-uploaded-quiz', ({ roomCode, quiz, timerDuration }) => {
            const room = rooms[roomCode];
            if (
                room &&
                room.hostId === socket.id &&
                Array.isArray(quiz) &&
                quiz.length > 0
            ) {
                room.quiz = quiz;
                room.quizParams = null;
                room.currentQuestionIndex = -1;
                room.scores = {};
                // Make sure timerDuration is always a number
                room.timerDuration = Number(timerDuration) || 15;
                room.phase = 'results';
                room.answeredThisRound = [];
                room.answerDistribution = {};
                room.playerAnswers = {};
                room.participants.forEach(p => {
                    room.playerAnswers[p.id] = [];
                });
                room.playerAnswers[room.hostId] = [];
                advanceGame(io, roomCode);
                socket.emit('quiz-review-data', quiz);
                console.log(`Quiz from file uploaded and started for room ${roomCode} with timerDuration ${room.timerDuration}`);
            } else {
                socket.emit('error', { message: 'Could not start quiz: invalid quiz data or permissions.' });
            }
        });


        socket.on('host-regenerate-quiz', async ({ roomCode }) => {
            const room = rooms[roomCode];
            if (room && room.hostId === socket.id && room.quizParams) {
                try {
                    console.log(`Host requested full quiz regeneration for room ${roomCode}.`);
                    const newQuizData = await generateQuiz(room.quizParams);
                    room.quiz = newQuizData;
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
                console.log(`Quiz for room ${roomCode} updated by host.`);
                socket.emit('quiz-update-ack', { success: true });
            }
        });

        socket.on('host-regenerate-single-question', async ({ roomCode, questionIndex }) => {
            const room = rooms[roomCode];
            if (
                room &&
                room.hostId === socket.id &&
                room.quizParams &&
                typeof questionIndex === 'number' &&
                room.quiz &&
                questionIndex < room.quiz.length
            ) {
                try {
                    console.log(`Host requested regeneration of question ${questionIndex} for room ${roomCode}.`);
                    const newQuestion = await generateSingleQuestion(room.quizParams, questionIndex);
                    if (newQuestion) {
                        room.quiz[questionIndex] = newQuestion;
                        socket.emit('single-question-updated', { questionIndex, newQuestion });
                        console.log(newQuestion);
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

        socket.on('submit-answer', ({ roomCode, questionIndex, answer }) => {
            const room = rooms[roomCode];
            if (
                room &&
                room.phase === 'question' &&
                room.quiz &&
                room.quiz[questionIndex] &&
                !room.answeredThisRound.includes(socket.id)
            ) {
                room.answeredThisRound.push(socket.id);

                if (!room.answerDistribution[answer]) {
                    room.answerDistribution[answer] = 0;
                }
                room.answerDistribution[answer]++;

                const isCorrect = room.quiz[questionIndex].correctAnswer === answer;
                if (isCorrect) {
                    if (!room.scores[socket.id]) {
                        room.scores[socket.id] = 0;
                    }
                    room.scores[socket.id]++;
                }

                if (room.playerAnswers && room.playerAnswers[socket.id]) {
                    room.playerAnswers[socket.id][questionIndex] = answer;
                }

                io.to(room.hostId).emit('host-update', {
                    answeredThisRound: room.answeredThisRound,
                    answerDistribution: room.answerDistribution,
                });

                io.to(roomCode).emit('update-answer-progress', {
                    answeredCount: room.answeredThisRound.length,
                    totalParticipants: room.participants.length,
                });
            }
        });

        socket.on('host-skip-question', roomCode => {
            const room = rooms[roomCode];
            if (room && room.hostId === socket.id && room.phase === 'question') {
                console.log(`Host in room [${roomCode}] skipped the question.`);
                advanceGame(io, roomCode);
            }
        });

        socket.on('host-end-quiz', roomCode => {
            const room = rooms[roomCode];
            if (room && room.hostId === socket.id) {
                console.log(`Host in room [${roomCode}] ended the quiz.`);
                if (room.timer) clearInterval(room.timer);

                const finalLeaderboard = room.participants
                    .map(p => ({ name: p.name, score: room.scores[p.id] || 0 }))
                    .sort((a, b) => b.score - a.score);

                io.to(roomCode).emit('game-over', {
                    leaderboard: finalLeaderboard,
                    quizData: room.quiz,
                    playerAnswers: room.playerAnswers,
                });
            }
        });

        socket.on('disconnect', () => {
            const disconnectedSocketId = socket.id;
            console.log(`User disconnected: ${disconnectedSocketId}`);

            const roomCode = Object.keys(rooms).find(key => {
                const room = rooms[key];
                return (
                    room.hostId === disconnectedSocketId ||
                    room.participants.some(p => p.id === disconnectedSocketId)
                );
            });

            if (!roomCode) return;

            const room = rooms[roomCode];

            if (room.hostId === disconnectedSocketId) {
                console.log(`Host disconnected from room [${roomCode}]. Ending game.`);
                if (room.timer) clearInterval(room.timer);

                io.to(roomCode).emit('host-disconnected');

                delete rooms[roomCode];
            } else {
                const idx = room.participants.findIndex(p => p.id === disconnectedSocketId);
                if (idx !== -1) {
                    const participantName = room.participants[idx].name;
                    console.log(`Participant "${participantName}" disconnected from room [${roomCode}].`);

                    room.participants.splice(idx, 1);

                    io.to(roomCode).emit('update-participants', room.participants);

                    if (room.phase === 'question') {
                        const answeredIndex = room.answeredThisRound.indexOf(disconnectedSocketId);
                        if (answeredIndex > -1) {
                            room.answeredThisRound.splice(answeredIndex, 1);
                        }

                        io.to(room.hostId).emit('host-update', {
                            answeredThisRound: room.answeredThisRound,
                            answerDistribution: room.answerDistribution,
                        });
                        io.to(roomCode).emit('update-answer-progress', {
                            answeredCount: room.answeredThisRound.length,
                            totalParticipants: room.participants.length,
                        });
                    }
                }
            }
        });
    });
}

module.exports = initializeSocket;
