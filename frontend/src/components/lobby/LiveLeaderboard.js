import React from 'react';
import './Leaderboard.css'; // We can reuse the same CSS

function LiveLeaderboard({ leaderboardData, correctAnswer }) {
  return (
    <div className="leaderboard live">
      <h2>Current Standings</h2>
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
