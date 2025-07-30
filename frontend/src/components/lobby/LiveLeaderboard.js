import React from 'react';
import './Leaderboard.css';

function LiveLeaderboard({ leaderboardData, correctAnswer, yourAnswer }) {
  const isCorrect= yourAnswer === correctAnswer;  
  return (
    <div className="leaderboard live">
      <h2>Current Standings</h2><h2>Live Standings</h2>
            <div className="answer-recap">
                <div className="recap-item">Correct Answer: <span>{correctAnswer}</span></div>
                {yourAnswer && (
                    <div className={`recap-item ${isCorrect ? 'correct' : 'incorrect'}`}>
                        Your Answer: <span>{yourAnswer}</span>
                    </div>
                )}
            </div>
      <p className="correct-answer-reveal">The correct answer was: <strong>{correctAnswer}</strong></p>
      <ol className="leaderboard-list">
        {leaderboardData.map((player) => (
          <li key={player.name}>
            <span className="name">{player.name}</span>
            <span className="score">{player.score} Points</span>
          </li>
        ))}
      </ol>
      <p className="next-question-timer">Next question coming up...</p>
    </div>
  );
}

export default LiveLeaderboard;
