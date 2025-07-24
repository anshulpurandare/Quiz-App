import React from 'react';
import './QuizReview.css';

function QuizReview({ quizData, onRestart }) {
  return (
    <div className="quiz-review">
      <h2>Quiz Review</h2>
      {quizData.map((item, index) => (
        <div key={index} className="review-card">
          <h4>{index + 1}. {item.question}</h4>
          <p className="correct-answer-final">Correct Answer: {item.correctAnswer}</p>
          <p className="explanation"><strong>Explanation:</strong> {item.explanation}</p>
        </div>
      ))}
      <button className="restart-btn" onClick={onRestart}>Play Again</button>
    </div>
  );
}

export default QuizReview;
