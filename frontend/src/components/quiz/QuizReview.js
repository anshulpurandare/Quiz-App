import React, { useState, useEffect } from 'react';
import { socket } from '../../socket';
import './QuizReview.css';

function QuizReview({
    initialQuizData,
    roomCode,
    isHostReview = false,
    onRegenerate,
    onStart,
    myAnswers,
    onRestart,
}) {
    const [quizData, setQuizData] = useState(initialQuizData);
    const [isSaving, setIsSaving] = useState(false);
    const [regeneratingIndex, setRegeneratingIndex] = useState(null);

    useEffect(() => {
        setQuizData(initialQuizData);
    }, [initialQuizData]);

    useEffect(() => {
        const handleSingleQuestionUpdated = ({ questionIndex, newQuestion }) => {
            setQuizData(prevData => {
                const newData = [...prevData];
                newData[questionIndex] = newQuestion;
                return newData;
            });
            setRegeneratingIndex(null);
        };

        socket.on('single-question-updated', handleSingleQuestionUpdated);

        return () => {
            socket.off('single-question-updated');
        };
    }, []);

    const handleRegenerateQuestion = (index) => {
        setRegeneratingIndex(index);
        socket.emit('host-regenerate-single-question', { roomCode, questionIndex: index });
    };

    const handleApproveAndStart = () => {
        setIsSaving(true);
        socket.emit('host-update-quiz', { roomCode, updatedQuiz: quizData });
        socket.once('quiz-update-ack', ({ success }) => {
            if (success) {
                onStart();
            } else {
                alert('Failed to save the quiz. Please try again.');
            }
            setIsSaving(false);
        });
    };

    if (isHostReview) {
        return (
            <div className="quiz-review-container">
                {/* --- [NEW] Header section with Room Code --- */}
                <div className="review-header">
                    <h2>Review and Edit Your Quiz</h2>
                    <p>Share this code with participants: <span className="room-code-display">{roomCode}</span></p>
                </div>

                <div className="questions-list">
                    {Array.isArray(quizData) && quizData.map((q, qIndex) => (
                        <div key={qIndex} className="question-editor">
                            <div className="question-header">
                                <h4>Question {qIndex + 1}</h4>
                                <button
                                    onClick={() => handleRegenerateQuestion(qIndex)}
                                    className="regenerate-question-btn"
                                    disabled={regeneratingIndex === qIndex}
                                >
                                    {regeneratingIndex === qIndex ? 'Regenerating...' : 'Regenerate'}
                                </button>
                            </div>
                            <textarea value={q.question} className="question-input" readOnly />
                            <div className="options-review-list">
                                {q.options && q.options.map((option, oIndex) => (
                                    <div
                                        key={oIndex}
                                        className={`review-option-item ${option === q.correctAnswer ? 'correct' : ''}`}
                                    >
                                        {option}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="review-actions">
                    <button onClick={handleApproveAndStart} disabled={isSaving} className="approve-btn">
                        {isSaving ? 'Saving...' : 'Approve & Start Quiz'}
                    </button>
                    <button onClick={onRegenerate} className="regenerate-btn" disabled={isSaving}>
                        Regenerate All
                    </button>
                </div>
            </div>
        );
    }

    // --- Participant's post-game review logic ---
    return (
        <div className="quiz-review">
            <h2>Quiz Review</h2>
            <div className="review-questions">
                {Array.isArray(quizData) && quizData.map((question, index) => {
                    const myAnswerForThisQ = myAnswers ? myAnswers[index] : null;
                    return (
                        <div key={index} className="review-card">
                            <h4>{index + 1}. {question.question}</h4>
                            <div className="options-review">
                                {question.options.map(option => {
                                    const isMyChoice = option === myAnswerForThisQ;
                                    const isTheCorrectChoice = option === question.correctAnswer;
                                    let optionClass = 'review-option';
                                    if (isTheCorrectChoice) {
                                        optionClass += ' correct';
                                    } else if (isMyChoice && !isTheCorrectChoice) {
                                        optionClass += ' incorrect';
                                    }
                                    return (
                                        <div key={option} className={optionClass}>
                                            {option}
                                        </div>
                                    );
                                })}
                            </div>
                            <p className="explanation"><strong>Explanation:</strong> {question.explanation}</p>
                        </div>
                    );
                })}
            </div>
            <button onClick={onRestart} className="restart-btn">Play Again</button>
        </div>
    );
}

export default QuizReview;
