import React from 'react';
import './ResultsScreen.css';

function ResultsScreen({ quizData, userAnswers, score, onRestart }) {
  return (
    <div className="results-screen">
      <h2>Quiz Complete!</h2>
      <h3>Your Score: {score} / {quizData.length}</h3>
      
      <div className="results-review">
        {quizData.map((question, index) => (
          <div key={index} className="result-card">
            <h4>{index + 1}. {question.question}</h4>
            <p className={`your-answer ${userAnswers[index] === question.correctAnswer ? 'correct' : 'incorrect'}`}>
              Your answer: {userAnswers[index] || "Not answered"}
            </p>
            {userAnswers[index] !== question.correctAnswer && (
              <p className="correct-answer">Correct answer: {question.correctAnswer}</p>
            )}
            <p className="explanation"><strong>Explanation:</strong> {question.explanation}</p>
          </div>
        ))}
      </div>
      
      <button className="restart-btn" onClick={onRestart}>
        Create Another Quiz
      </button>
    </div>
  );
}

export default ResultsScreen;
