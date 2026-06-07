import React, { useState, useRef, useEffect } from 'react';

function ChatScreen({ user, messages, onlineUsers, typingUsers, onSendMessage, onStartTyping, onStopTyping, onDisconnect, serverUrl }) {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
    handleStopTyping();
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);

    if (!isTyping) {
      setIsTyping(true);
      onStartTyping();
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping();
    }, 2000);
  };

  const handleStopTyping = () => {
    if (isTyping) {
      setIsTyping(false);
      onStopTyping();
    }
    clearTimeout(typingTimeoutRef.current);
  };

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getInitials = (name) => {
    return name.charAt(0).toUpperCase();
  };

  const filteredTyping = typingUsers.filter(u => u.username !== user.username);

  return (
    <div className="chat-layout">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>NexusChat</h2>
          <button className="disconnect-btn" onClick={onDisconnect} title="Disconnect">
            &#x2716;
          </button>
        </div>

        <div className="server-info">
          Connected to: <code>{serverUrl.replace('http://', '')}</code>
        </div>

        <div className="online-section">
          <h3>Online — {onlineUsers.length}</h3>
          {onlineUsers.map(u => (
            <div className="user-item" key={u.username}>
              <div className="user-avatar" style={{ background: u.avatarColor }}>
                {getInitials(u.displayName)}
                <span className="online-dot"></span>
              </div>
              <span className="user-name">
                {u.displayName}
                {u.username === user.username ? ' (You)' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="chat-area">
        <div className="chat-header">
          <h3># General Chat</h3>
          <span>{onlineUsers.length} online</span>
        </div>

        <div className="messages-container">
          {messages.length === 0 && (
            <div className="welcome-message">
              <h2>Welcome to NexusChat!</h2>
              <p>Send a message to start the conversation.</p>
            </div>
          )}

          {messages.map((msg, idx) => {
            const isOwn = msg.username === user.username;
            const showAvatar = idx === 0 || messages[idx - 1].username !== msg.username;

            return (
              <div key={msg.id || idx} className={`message ${isOwn ? 'own' : 'other'}`}>
                {showAvatar && (
                  <div className="message-avatar" style={{ background: msg.avatarColor || '#6366f1' }}>
                    {getInitials(msg.displayName || msg.username)}
                  </div>
                )}
                {!showAvatar && <div style={{ width: 36 }} />}
                <div className="message-content">
                  {showAvatar && (
                    <span className="message-sender">{msg.displayName || msg.username}</span>
                  )}
                  <div className="message-bubble">{msg.content}</div>
                  {showAvatar && (
                    <span className="message-time">{formatTime(msg.createdAt)}</span>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {filteredTyping.length > 0 && (
          <div className="typing-indicator">
            {filteredTyping.map(u => u.displayName).join(', ')}{' '}
            {filteredTyping.length === 1 ? 'is typing...' : 'are typing...'}
          </div>
        )}

        <div className="message-input-area">
          <form className="message-input-wrapper" onSubmit={handleSend}>
            <input
              className="message-input"
              type="text"
              placeholder="Type a message..."
              value={input}
              onChange={handleInputChange}
              onBlur={handleStopTyping}
            />
            <button type="submit" className="send-btn" disabled={!input.trim()}>
              &#x27A4;
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ChatScreen;
