import React, { useState, useEffect } from 'react';
import './InteractiveQuiz.css';
import { socket } from '../../socket';

function InteractiveQuiz({ roomCode, questionData, onQuizSubmit }) {
    const [timeRemaining, setTimeRemaining] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [progress, setProgress] = useState({ answeredCount: 0, totalParticipants: 0 });

    useEffect(() => {
        setSelectedAnswer(null);
        setIsAnswered(false);
        setProgress({ answeredCount: 0, totalParticipants: 0 });
    }, [questionData]);

    useEffect(() => {
        socket.on('timer-tick', (data) => {
            setTimeRemaining(data.remainingTime);
        });
        socket.on('update-answer-progress', (data) => {
            setProgress(data);
        });

        return () => {
            socket.off('timer-tick');
            socket.off('update-answer-progress');
        };
    }, []);

    const handleAnswerSelect = (answer) => {
        if (!isAnswered) {
            setSelectedAnswer(answer);
            setIsAnswered(true);
            socket.emit('submit-answer', {
                roomCode,
                questionIndex: questionData.questionIndex,
                answer,
            });
        }
    };

    if (!questionData) {
        return <div className="waiting-room"><h2>Loading quiz...</h2></div>;
    }

    return (
        <div className="interactive-quiz">
            <div className="quiz-header">
                <span>Question {questionData.questionIndex + 1} of {questionData.totalQuestions}</span>
                <div className="timer">{timeRemaining}s</div>
            </div>
            <h2>{questionData.question}</h2>
            <div className="options-container">
                {questionData.options.map((option, index) => (
                    <button
                        key={index}
                        className={`option-btn ${selectedAnswer === option ? 'selected' : ''}`}
                        onClick={() => handleAnswerSelect(option)}
                        disabled={isAnswered}
                    >
                        {option}
                    </button>
                ))}
            </div>
            <div className="feedback">
                {isAnswered 
                    ? "Your answer has been submitted! Waiting for results..."
                    : "Select your answer above."
                }
            </div>
            <div className="progress-indicator">
                <span>{progress.answeredCount} of {progress.totalParticipants} have answered</span>
            </div>
        </div>
    );
}

export default InteractiveQuiz;
