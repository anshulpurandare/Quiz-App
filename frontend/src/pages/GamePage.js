import React, { useState, useEffect } from 'react';
import { socket } from '../socket';

// Import all view components
import HostView from '../components/lobby/HostView';
import ParticipantView from '../components/lobby/ParticipantView';
import InteractiveQuiz from '../components/quiz/InteractiveQuiz';
import Leaderboard from '../components/lobby/Leaderboard';
import Loader from '../components/common/Loader';
import './GamePage.css';

function GamePage() {
    const [view, setView] = useState('lobby');
    const [error, setError] = useState('');
    
    // State Management
    const [name, setName] = useState('');
    const [isHost, setIsHost] = useState(false);
    const [roomCode, setRoomCode] = useState('');
    const [roomCodeInput, setRoomCodeInput] = useState('');
    const [participants, setParticipants] = useState([]);
    
    // --- REFINED LOADING STATE ---
    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState(''); // New state for the message

    // Quiz & Results State
    const [quizData, setQuizData] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);

    useEffect(() => {
        socket.on('update-participants', setParticipants);
        socket.on('quiz-started', (quiz) => {
            setQuizData(quiz);
            setView(isHost ? 'host_monitor' : 'quiz');
        });
        socket.on('game-over', (finalLeaderboard) => {
            setLeaderboard(finalLeaderboard);
            setView('leaderboard');
        });
        return () => {
            socket.off('update-participants');
            socket.off('quiz-started');
            socket.off('game-over');
        };
    }, [isHost]);

    const handleCreateRoom = () => {
        setLoadingMessage('Creating Room...'); // Set a specific message
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
        setLoadingMessage('Joining Room...'); // Set a specific message
        setLoading(true);
        if (name && roomCodeInput) {
            socket.emit('join-room', { roomCode: roomCodeInput, name }, (response) => {
                if (response.success) {
                    setIsHost(false);
                    setRoomCode(roomCodeInput);
                    setParticipants(response.roomData.participants);
                    setView('waiting');
                } else {
                    setError(response.message);
                }
                setLoading(false);
            });
        }
    };
    
    const handleQuizSubmit = () => {
        setView('waiting_results');
    };

    const handleRestart = () => {
        setView('lobby');
        setQuizData(null);
        setLeaderboard([]);
        setRoomCode('');
        setRoomCodeInput('');
        setError('');
    };
    
    // --- UPDATED RENDER LOGIC ---
    if (loading) {
        // Pass the custom message to the Loader component
        return <Loader message={loadingMessage} />;
    }

    const renderLobby = () => (
        <div className="lobby-container">
            <h3>Join a Quiz</h3>
            <form onSubmit={handleJoinRoom}>
                <input type="text" placeholder="Your Name" value={name} onChange={(e) => setName(e.target.value)} required />
                <input type="text" placeholder="Room Code" value={roomCodeInput} onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())} required />
                <button type="submit">Join Room</button>
            </form>
            <div className="divider">OR</div>
            <h3>Host a Quiz</h3>
            <button onClick={handleCreateRoom}>Create a New Room</button>
        </div>
    );

    const renderContent = () => {
        switch (view) {
            case 'waiting':
                return isHost ? 
                    <HostView roomCode={roomCode} participants={participants} socket={socket} /> : 
                    <ParticipantView roomCode={roomCode} participants={participants} name={name} />;
            case 'host_monitor':
                return <div className="waiting-room"><h2>Quiz in Progress...</h2><p>The leaderboard will be displayed here once all participants have finished.</p></div>;
            case 'quiz':
                return <InteractiveQuiz quizData={quizData} roomCode={roomCode} onQuizSubmit={handleQuizSubmit} />;
            case 'waiting_results':
                return <div className="waiting-room"><h2>Answers Submitted!</h2><p>Waiting for other players to finish...</p></div>;
            case 'leaderboard':
                return <Leaderboard leaderboardData={leaderboard} onRestart={handleRestart} />;
            default: // lobby
                return renderLobby();
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
