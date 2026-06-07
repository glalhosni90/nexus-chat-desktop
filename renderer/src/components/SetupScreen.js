import React, { useState, useEffect } from 'react';

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6'];

function SetupScreen({ onConnect, error }) {
  const [mode, setMode] = useState('host'); // 'host' or 'join'
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarColor, setAvatarColor] = useState(COLORS[0]);
  const [serverAddress, setServerAddress] = useState('');
  const [localIP, setLocalIP] = useState('');
  const [serverPort, setServerPort] = useState('');

  useEffect(() => {
    // Get server info from Electron
    if (window.electronAPI) {
      window.electronAPI.getServerInfo().then(info => {
        if (info) {
          setServerPort(String(info.port));
        }
      });
      window.electronAPI.getLocalIP().then(ip => {
        setLocalIP(ip);
      });
    }
  }, []);

  const handleConnect = (e) => {
    e.preventDefault();
    if (!username.trim() || !displayName.trim()) return;

    let url;
    if (mode === 'host') {
      url = `http://localhost:${serverPort}`;
    } else {
      url = serverAddress.startsWith('http') ? serverAddress : `http://${serverAddress}`;
    }

    onConnect(url, username.trim(), displayName.trim(), avatarColor);
  };

  const isValid = username.trim().length >= 2 && displayName.trim().length >= 1 &&
    (mode === 'host' ? serverPort : serverAddress.trim());

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <h1>NexusChat</h1>
        <p>Local Network Chat Application</p>

        {error && <div className="error-msg">{error}</div>}

        <div className="mode-tabs">
          <div className={`mode-tab ${mode === 'host' ? 'active' : ''}`} onClick={() => setMode('host')}>
            Host (Server)
          </div>
          <div className={`mode-tab ${mode === 'join' ? 'active' : ''}`} onClick={() => setMode('join')}>
            Join
          </div>
        </div>

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

          {mode === 'host' ? (
            <div className="form-group">
              <label>Your Server Address (share this with others)</label>
              <input
                type="text"
                value={localIP ? `${localIP}:${serverPort}` : `Loading...`}
                readOnly
                style={{ cursor: 'default', opacity: 0.8 }}
              />
            </div>
          ) : (
            <div className="form-group">
              <label>Server Address</label>
              <input
                type="text"
                placeholder="e.g. 192.168.1.5:3456"
                value={serverAddress}
                onChange={e => setServerAddress(e.target.value)}
              />
            </div>
          )}

          <button type="submit" className="setup-btn" disabled={!isValid}>
            {mode === 'host' ? 'Start Chatting' : 'Connect'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default SetupScreen;
