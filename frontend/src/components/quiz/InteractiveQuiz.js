import React, { useState } from 'react';
import './InteractiveQuiz.css';
import { socket } from '../../socket'; // Import the socket

function InteractiveQuiz({ quizData, roomCode, onQuizSubmit }) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});

  const handleAnswerSelect = (questionIndex, answer) => {
    setSelectedAnswers({ ...selectedAnswers, [questionIndex]: answer });
  };

  const handleSubmit = () => {
    let score = 0;
    quizData.forEach((question, index) => {
      if (selectedAnswers[index] === question.correctAnswer) {
        score++;
      }
    });

    // Emit the final score to the server
    socket.emit('submit-answers', { roomCode, score });
    onQuizSubmit(); // Tell the parent component to switch to a "waiting" view
  };

  const currentQuestion = quizData[currentQuestionIndex];

  return (
    <div className="interactive-quiz">
      <h2>{currentQuestion.question}</h2>
      <div className="options-container">
        {currentQuestion.options.map((option, index) => (
          <button
            key={index}
            className={`option-btn ${selectedAnswers[currentQuestionIndex] === option ? 'selected' : ''}`}
            onClick={() => handleAnswerSelect(currentQuestionIndex, option)}
          >
            {option}
          </button>
        ))}
      </div>
      <div className="navigation-buttons">
        {currentQuestionIndex > 0 && (
          <button onClick={() => setCurrentQuestionIndex(currentQuestionIndex - 1)}>Previous</button>
        )}
        {currentQuestionIndex < quizData.length - 1 && (
          <button onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}>Next</button>
        )}
        {currentQuestionIndex === quizData.length - 1 && (
          <button className="submit-btn" onClick={handleSubmit}>Submit Final Answers</button>
        )}
      </div>
      <div className="progress-indicator">
        Question {currentQuestionIndex + 1} of {quizData.length}
      </div>
    </div>
  );
}

export default InteractiveQuiz;
