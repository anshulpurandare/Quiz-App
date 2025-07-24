import React, { useState, useEffect } from 'react';
import './InteractiveQuiz.css';
import { socket } from '../../socket';

// This component is now simpler. It receives the question data as a prop.
function InteractiveQuiz({ roomCode, questionData, onQuizSubmit }) {
    const [timeRemaining, setTimeRemaining] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [isAnswered, setIsAnswered] = useState(false);

    useEffect(() => {
        // This effect runs whenever a new question is passed down as a prop
        setSelectedAnswer(null); // Reset selection
        setIsAnswered(false);   // Allow a new answer
    }, [questionData]); // Dependency array ensures this resets for each new question

    useEffect(() => {
        // This component only needs to listen for the timer
        socket.on('timer-tick', (data) => {
            setTimeRemaining(data.remainingTime);
        });

        return () => {
            socket.off('timer-tick');
        };
    }, []); // This only runs once

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
            {isAnswered && <div className="feedback">Your answer has been submitted! Waiting for the next question...</div>}
        </div>
    );
}

export default InteractiveQuiz;
