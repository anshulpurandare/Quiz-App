import React from 'react';
import './App.css';
import GamePage from './pages/GamePage';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>AI Multiplayer Quiz</h1>
        <p>Host or join a real-time quiz game.</p>
      </header>
      <main>
        <GamePage />
      </main>
    </div>
  );
}

export default App;
