import React, { useState, useEffect } from 'react';
import { socket } from '../../socket';
import QuizReview from '../quiz/QuizReview';
import './HostView.css';

function HostView({ roomCode, participants }) {
    const [quizParams, setQuizParams] = useState({
        topic: 'World History',
        subtopics: 'Ancient Rome',
        difficulty: 'medium',
        numQuestions: 5,
    });
    const [isGenerating, setIsGenerating] = useState(false);
    const [timerDuration, setTimerDuration] = useState(15);
    const [quizForReview, setQuizForReview] = useState(null);

    useEffect(() => {
        const handleQuizData = (data) => {
            setQuizForReview(data);
            setIsGenerating(false);
        };
        const handleError = (error) => {
            alert(`Error: ${error.message}`);
            setIsGenerating(false);
        };

        socket.on('quiz-review-data', handleQuizData);
        socket.on('error', handleError);

        return () => {
            socket.off('quiz-review-data', handleQuizData);
            socket.off('error', handleError);
        };
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setQuizParams(prev => ({ ...prev, [name]: value }));
    };

    const handleGenerateQuiz = (e) => {
        e.preventDefault();
        setIsGenerating(true);
        socket.emit('host-generate-quiz', {
            ...quizParams,
            subtopics: quizParams.subtopics.split(',').map(s => s.trim()),
            numQuestions: Number(quizParams.numQuestions),
            roomCode,
        });
    };

    const handleRegenerateAll = () => {
        setIsGenerating(true);
        setQuizForReview(null);
        socket.emit('host-regenerate-quiz', { roomCode });
    };

    const handleStartQuiz = () => {
        socket.emit('start-quiz', { roomCode, timerDuration });
    };

    if (quizForReview) {
        return (
            <QuizReview
                initialQuizData={quizForReview}
                roomCode={roomCode}
                isHostReview={true}
                // [FIXED] This correctly passes the function to the child component
                onRegenerate={handleRegenerateAll}
                onStart={handleStartQuiz}
            />
        );
    }

    return (
        <div className="host-view">
            <div className="lobby-info">
                <h2>Room Code: <span className="room-code-display">{roomCode}</span></h2>
                <p>Share this code with participants to join.</p>
                <h3>Participants ({participants.length})</h3>
                <ul>
                    {participants.map(p => <li key={p.id}>{p.name}</li>)}
                    {participants.length === 0 && <li>Waiting for participants...</li>}
                </ul>
            </div>
            
            <div className="quiz-setup">
                <h3>Setup Your Quiz</h3>
                <form onSubmit={handleGenerateQuiz}>
                    <input name="topic" value={quizParams.topic} onChange={handleInputChange} placeholder="Topic" />
                    <input name="subtopics" value={quizParams.subtopics} onChange={handleInputChange} placeholder="Subtopics (comma-separated)" />
                    <select name="difficulty" value={quizParams.difficulty} onChange={handleInputChange}>
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                    </select>
                    <input name="numQuestions" type="number" min="1" max="10" value={quizParams.numQuestions} onChange={handleInputChange} />
                    <button type="submit" disabled={isGenerating}>
                        {isGenerating ? 'Generating...' : 'Generate Quiz'}
                    </button>
                </form>

                <div className="timer-setup">
                    <label htmlFor="timer">Time per Question (s)</label>
                    <input id="timer" type="number" min="5" max="60" value={timerDuration} onChange={(e) => setTimerDuration(Number(e.target.value))} />
                </div>
            </div>
        </div>
    );
}

export default HostView;
