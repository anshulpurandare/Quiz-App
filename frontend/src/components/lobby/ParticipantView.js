import React from 'react';
import './ParticipantView.css'; // Import the new CSS file

function ParticipantView({ roomCode, participants, name }) {
  // Combine own name with the list of other participants
  const allParticipants = [{ id: 'you', name: `${name} (You)` }, ...participants];

  return (
    <div className="participant-view">
      <h2>Joined Room: <span className="room-code-display">{roomCode}</span></h2>
      <p>Waiting for the host to start the quiz...</p>
      
      <div className="participant-list-container">
        <h3>Participants ({allParticipants.length})</h3>
        <ul className="participant-list">
          {allParticipants.map((p) => (
            <li key={p.id} className="participant-list-item">
              <div className="avatar">{p.name.charAt(0).toUpperCase()}</div>
              <span className="name">{p.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default ParticipantView;
