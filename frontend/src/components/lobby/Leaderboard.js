import React from 'react';
import './Leaderboard.css';

function Leaderboard({ leaderboardData, onRestart,onReview }) {
  return (
    <div className="leaderboard">
      <h2>Final Results</h2>
      <ol className="leaderboard-list">
        {leaderboardData.map((player, index) => (
          <li key={player.name}>
            <span className="rank">{index + 1}</span>
            <span className="name">{player.name}</span>
            <span className="score">{player.score} Points</span>
          </li>
        ))}
      </ol>
      <div className="final-buttons">
        <button className="restart-btn" onClick={onReview}>Review Answers</button>
        <button className="restart-btn" onClick={onRestart}>Play Again</button>
      </div>
    </div>
  );
}

export default Leaderboard;
