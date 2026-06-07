import React, { useState, useEffect } from 'react';

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6'];

function SetupScreen({ onConnect, error }) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarColor, setAvatarColor] = useState(COLORS[0]);

  const handleConnect = (e) => {
    e.preventDefault();
    if (!username.trim() || !displayName.trim()) return;

    // Connect to the same origin (works for both local dev and deployed)
    const url = window.location.origin;
    onConnect(url, username.trim(), displayName.trim(), avatarColor);
  };

  const isValid = username.trim().length >= 2 && displayName.trim().length >= 1;

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <h1>NexusChat</h1>
        <p>Real-time Chat — Join the conversation!</p>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleConnect}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              placeholder="e.g. john_doe"
              value={username}
              onChange={e => setUsername(e.target.value)}
              maxLength={20}
            />
          </div>

          <div className="form-group">
            <label>Display Name</label>
            <input
              type="text"
              placeholder="e.g. John"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              maxLength={30}
            />
          </div>

          <div className="form-group">
            <label>Avatar Color</label>
            <div className="color-picker">
              {COLORS.map(color => (
                <div
                  key={color}
                  className={`color-option ${avatarColor === color ? 'selected' : ''}`}
                  style={{ background: color }}
                  onClick={() => setAvatarColor(color)}
                />
              ))}
            </div>
          </div>

          <button type="submit" className="setup-btn" disabled={!isValid}>
            Join Chat
          </button>
        </form>
      </div>
    </div>
  );
}

export default SetupScreen;
