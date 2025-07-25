import React, { useState, useEffect } from 'react';
import { socket } from '../socket';
// Import all view components
import HostDashboard from '../components/lobby/HostDashboard';
import HostView from '../components/lobby/HostView';
import ParticipantView from '../components/lobby/ParticipantView';
import InteractiveQuiz from '../components/quiz/InteractiveQuiz';
import Leaderboard from '../components/lobby/Leaderboard';
import LiveLeaderboard from '../components/lobby/LiveLeaderboard';
import QuizReview from '../components/quiz/QuizReview';
import Loader from '../components/common/Loader';
import './GamePage.css';

function GamePage() {
    const [view, setView] = useState('lobby');
    const [error, setError] = useState('');
    
    // User & Room State
    const [name, setName] = useState('');
    const [isHost, setIsHost] = useState(false);
    const [roomCode, setRoomCode] = useState('');
    const [roomCodeInput, setRoomCodeInput] = useState('');
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');

    // Centralized Quiz & Results State
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [correctAnswer, setCorrectAnswer] = useState('');
    const [fullQuizData, setFullQuizData] = useState(null);

    useEffect(() => {
        function setupSocketListeners() {
            socket.on('update-participants', setParticipants);

            socket.on('quiz-started', (firstQuestionData) => {
                setCurrentQuestion(firstQuestionData);
                setView(isHost ? 'host_monitor' : 'quiz');
            });

            
            socket.on('new-question', (newQuestionData) => {
                setCurrentQuestion(newQuestionData);
                setView(isHost ? 'host_monitor' : 'quiz'); 
            })
            
            socket.on('update-leaderboard', setLeaderboard);

            socket.on('question-over', (data) => {
                setCorrectAnswer(data.correctAnswer);
                setView('live_leaderboard');
            });

            socket.on('game-over', (data) => {
                if (data && data.leaderboard) {
                    setLeaderboard(data.leaderboard);
                    setFullQuizData(data.quizData);
                    setView('leaderboard');
                }
            });
            socket.on('host-disconnected', () => {
                alert('The host has disconnected. The game has ended. Returning to the main screen.');
                // Your existing handleRestart function is perfect for resetting the UI.
                handleRestart(); 
            });
        }
        setupSocketListeners();

        return () => {
            socket.off('update-participants');
            socket.off('quiz-started');
            socket.off('new-question');
            socket.off('update-leaderboard');
            socket.off('question-over');
            socket.off('game-over');
            socket.off('host-disconnected'); 
        };
    }, [isHost]);

    // All handler functions are correct
    const handleCreateRoom = () => {
        setLoadingMessage('Creating Room...');
        setLoading(true);
        socket.emit('create-room', (response) => {
            setIsHost(true);
            setRoomCode(response.roomCode);
            setView('waiting');
            setLoading(false);
        });
    };

    const handleJoinRoom = (e) => {
        e.preventDefault();
        setError('');
        setLoadingMessage('Joining Room...');
        setLoading(true);
        if (name && roomCodeInput) {
            socket.emit('join-room', { roomCode: roomCodeInput, name }, (response) => {
                if (response.success) {
                    setIsHost(false);
                    setRoomCode(roomCodeInput);
                    setParticipants(response.roomData.participants);
                    setView('waiting');
                } else { setError(response.message); }
                setLoading(false);
            });
        }
    };
    
    const handleQuizSubmit = () => { setView('waiting_results'); };
    const handleShowReview = () => { setView('quiz_review'); };
    const handleRestart = () => {
        setView('lobby');
        setCurrentQuestion(null);
        setLeaderboard([]);
        setFullQuizData(null);
        setRoomCode('');
        setRoomCodeInput('');
        setError('');
        setIsHost(false);
    };
    
    if (loading) { return <Loader message={loadingMessage} />; }

    // In src/pages/GamePage.js

    const renderLobby = () => (
        <div className="lobby-container">
            <div className="join-section">
                <h3>Join a Quiz</h3>
                <form onSubmit={handleJoinRoom}>
                    <input 
                        type="text" 
                        placeholder="Your Name" 
                        value={name} 
                        onChange={(e) => setName(e.target.value)} 
                        required 
                    />
                    {/* --- THIS IS THE NEW WRAPPER DIV --- */}
                    <div className="form-row">
                        <input 
                            type="text" 
                            placeholder="Room Code" 
                            value={roomCodeInput} 
                            onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())} 
                            required 
                        />
                        <button type="submit">Join</button>
                    </div>
                </form>
            </div>

            <div className="divider">
                <span>OR</span>
            </div>
            
            <div className="create-section">
                <h3>Host a Quiz</h3>
                <p>Create a new room and invite your friends to play!</p>
                <button onClick={handleCreateRoom}>Create a New Room</button>
            </div>
        </div>
    );


    const renderContent = () => {
        switch (view) {
            case 'waiting': return isHost ? <HostView roomCode={roomCode} participants={participants} socket={socket} /> : <ParticipantView roomCode={roomCode} participants={participants} name={name} />;
            case 'host_monitor': return <HostDashboard roomCode={roomCode}  questionData={currentQuestion} participants={participants} />;
            case 'quiz': return <InteractiveQuiz roomCode={roomCode} questionData={currentQuestion} onQuizSubmit={handleQuizSubmit} />;
            case 'waiting_results': return <div className="waiting-room"><h2>Answers Submitted!</h2><p>Waiting for other players to finish...</p></div>;
            case 'live_leaderboard': return <LiveLeaderboard leaderboardData={leaderboard} correctAnswer={correctAnswer} />;
            case 'leaderboard': return <Leaderboard leaderboardData={leaderboard} onRestart={handleRestart} onReview={handleShowReview} />;
            case 'quiz_review': return <QuizReview quizData={fullQuizData} onRestart={handleRestart} />;

            default: return renderLobby();
        }
    };

    return (
        <div className="game-page">
            {error && <div className="error-message">{error}</div>}
            {renderContent()}
        </div>
    );
}

export default GamePage;
