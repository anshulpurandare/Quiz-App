import React from 'react';

function ParticipantView({ roomCode, participants, name }) {
  return (
    <div className="waiting-room">
      <h2>Joined Room: <span className="room-code-display">{roomCode}</span></h2>
      <p>Waiting for the host to start the quiz...</p>
      <h3>Participants ({participants.length + 1})</h3>
      <ul>
        <li>{name} (You)</li>
        {participants.map((p) => <li key={p.id}>{p.name}</li>)}
      </ul>
    </div>
  );
}

export default ParticipantView;
