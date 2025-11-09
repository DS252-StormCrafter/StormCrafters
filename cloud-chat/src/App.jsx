import React, { useState } from 'react';
import Login from './Login';
import Signup from './Signup';
import ChatUI from './ChatUI';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [showSignup, setShowSignup] = useState(false);

  const handleLogin = (username) => {
    setUser(username);
  };

  const handleSignup = (username, password) => {
    setUser(username);
  };

  const switchToSignup = () => setShowSignup(true);
  const switchToLogin = () => setShowSignup(false);

  return (
    <>
      {!user ? (
        showSignup ? (
          <Signup onSignup={handleSignup} onSwitchToLogin={switchToLogin} />
        ) : (
          <Login onLogin={handleLogin} />
        )
      ) : (
        <ChatUI user={user} />
      )}
      {!user && !showSignup && (
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <span>New user? </span>
          <button className="link-btn" onClick={switchToSignup}>Sign Up</button>
        </div>
      )}
    </>
  );
}

export default App;
