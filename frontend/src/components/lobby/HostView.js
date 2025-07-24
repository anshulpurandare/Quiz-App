import React, { useState } from 'react';
import './HostView.css';

// Reusing the original QuizForm logic inside the HostView
function HostView({ roomCode, participants, socket }) {
  const [quizParams, setQuizParams] = useState({
    topic: 'Science',
    subtopics: 'Biology',
    difficulty: 'medium',
    numQuestions: 5,
  });
  const [isQuizGenerated, setIsQuizGenerated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

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
    }, (response) => {
      setIsGenerating(false);
      if (response.success) {
        setIsQuizGenerated(true);
      } else {
        alert(`Error generating quiz: ${response.message}`);
      }
    });
  };

  const handleStartQuiz = () => {
    socket.emit('start-quiz', roomCode);
  };

  return (
    <div className="host-view">
      <div className="lobby-info">
        <h2>Room Code: <span className="room-code-display">{roomCode}</span></h2>
        <p>Share this code with participants. The quiz will begin when you start it.</p>
        <h3>Participants ({participants.length})</h3>
        <ul>
          {participants.map(p => <li key={p.id}>{p.name}</li>)}
          {participants.length === 0 && <li>Waiting for participants to join...</li>}
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

        {isQuizGenerated && (
          <button className="start-quiz-btn" onClick={handleStartQuiz}>
            Start Quiz for Everyone
          </button>
        )}
      </div>
    </div>
  );
}

export default HostView;
