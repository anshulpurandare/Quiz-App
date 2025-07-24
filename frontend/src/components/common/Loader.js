import React from 'react';
import './Loader.css';

// The Loader now accepts a 'message' prop.
// If no message is provided, it defaults to "Loading...".
function Loader({ message = "Loading..." }) {
  return (
    <div className="loader-container">
      <div className="loader"></div>
      <p>{message}</p>
    </div>
  );
}

export default Loader;
