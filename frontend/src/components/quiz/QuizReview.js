import React from 'react';
import './QuizReview.css';
// This component now receives 'myAnswers'
function QuizReview({ quizData, myAnswers, onRestart }) {
    return (
        <div className="quiz-review">
            <h2>Quiz Review</h2>
            <div className="review-questions">
                {quizData.map((question, index) => {
                    const myAnswerForThisQ = myAnswers[index];
                    const isCorrect = myAnswerForThisQ === question.correctAnswer;
                    
                    return (
                        <div key={index} className="review-card">
                            <h4>{index + 1}. {question.question}</h4>
                            <div className="options-review">
                                {question.options.map(option => {
                                    const isMyChoice = option === myAnswerForThisQ;
                                    const isTheCorrectChoice = option === question.correctAnswer;
                                    
                                    // Determine the class for styling
                                    let optionClass = '';
                                    if (isTheCorrectChoice) optionClass = 'correct';
                                    else if (isMyChoice && !isCorrect) optionClass = 'incorrect';

                                    return (
                                        <div key={option} className={`review-option ${optionClass}`}>
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
            <button onClick={onRestart}>Play Again</button>
        </div>
    );
}
export default QuizReview;