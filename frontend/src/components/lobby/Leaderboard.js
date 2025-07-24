import React from 'react';
import './Leaderboard.css';

function Leaderboard({ leaderboardData, onRestart }) {
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
      <button className="restart-btn" onClick={onRestart}>Play Again</button>
    </div>
  );
}

export default Leaderboard;
