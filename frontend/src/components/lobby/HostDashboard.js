import React, { useState, useEffect } from 'react';
import { socket } from '../../socket';
import './HostDashboard.css';

function HostDashboard({ roomCode, questionData, participants }) {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [answeredIds, setAnsweredIds] = useState([]);
  const [answerDistribution, setAnswerDistribution] = useState({});

  useEffect(() => {
    const onTimerTick = (data) => setTimeRemaining(data.remainingTime);
    const onHostUpdate = (data) => {
      setAnsweredIds(data.answeredThisRound);
      setAnswerDistribution(data.answerDistribution);
    };

    socket.on('timer-tick', onTimerTick);
    socket.on('host-update', onHostUpdate);

    return () => {
      socket.off('timer-tick', onTimerTick);
      socket.off('host-update', onHostUpdate);
    };
  }, []);

  useEffect(() => {
    setAnsweredIds([]);
    setAnswerDistribution({});
  }, [questionData]);

  const handleSkip = () => {
    socket.emit('host-skip-question', roomCode);
  };

  const handleEnd = () => {
    if (window.confirm("Are you sure you want to end the quiz for everyone?")) {
      socket.emit('host-end-quiz', roomCode);
    }
  };

  const answeredCount = answeredIds.length;
  const totalParticipants = participants.length;
  const progress = totalParticipants > 0 ? (answeredCount / totalParticipants) * 100 : 0;

  const renderDistributionChart = () => {
    const totalAnswers = Object.values(answerDistribution).reduce((sum, count) => sum + count, 0);
    return (
      <div className="distribution-chart">
        <h4>Live Answer Distribution</h4>
        {questionData?.options?.map((option, index) => {
          const count = answerDistribution[option] || 0;
          const percentage = totalAnswers > 0 ? (count / totalAnswers) * 100 : 0;
          return (
            <div key={index} className="bar-item">
              <span className="bar-label">{option}</span>
              <div className="bar-wrapper">
                <div className="bar" style={{ width: `${percentage}%` }}></div>
              </div>
              <span className="bar-count">{count}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="host-dashboard">
      <div className="question-panel">
        <h3>
          Question {questionData ? questionData.questionIndex + 1 : '-'} of {questionData ? questionData.totalQuestions : '-'}
        </h3>
        <h2>{questionData?.question || 'Loading question...'}</h2>
        <div className="options-preview">
          {questionData?.options?.map((option, index) => (
            <div 
              key={index} 
              className={`option-preview ${option === questionData.correctAnswer ? 'correct' : ''}`}
            >
              {option}
            </div>
          ))}
        </div>
        {renderDistributionChart()}
      </div>

      <div className="status-panel">
        <div className="status-item timer">
          <span>Time Left</span>
          <div className="timer-display">{timeRemaining}s</div>
        </div>

        <div className="status-item progress">
          <span>Answers Submitted</span>
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${progress}%` }}></div>
          </div>
          <span className="progress-text">{answeredCount} / {totalParticipants}</span>
        </div>

        <div className="status-item participants">
          <span>Participants</span>
          <ul>
            {participants.map((p) => (
              <li key={p.id} className={answeredIds.includes(p.id) ? 'answered' : ''}>
                {p.name}
              </li>
            ))}
          </ul>
        </div>

        <div className="host-controls">
          <button onClick={handleSkip}>Skip to Results</button>
          <button className="end-btn" onClick={handleEnd}>End Quiz</button>
        </div>
      </div>
    </div>
  );
}

export default HostDashboard;
