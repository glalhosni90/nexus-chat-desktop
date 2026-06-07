import React, { useState, useRef, useEffect } from 'react';

function ChatView({ user, activeChat, messages, socket, isTyping, isOnline, onSendMessage }) {
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeout = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
    stopTyping();
  };

  const handleInput = (e) => {
    setInput(e.target.value);
    if (!typing && socket && activeChat) {
      setTyping(true);
      socket.emit('typing:start', { toUserId: activeChat.id });
    }
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(stopTyping, 2000);
  };

  const stopTyping = () => {
    if (typing && socket && activeChat) {
      setTyping(false);
      socket.emit('typing:stop', { toUserId: activeChat.id });
    }
    clearTimeout(typingTimeout.current);
  };

  const formatTime = (iso) => {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!activeChat) {
    return (
      <div className="chat-view empty-chat">
        <div className="empty-state">
          <div className="empty-icon">&#x1F4AC;</div>
          <h2>Welcome to NexusChat</h2>
          <p>Select a conversation or search for people to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-view">
      <div className="chat-header">
        <div className="chat-header-avatar" style={{ background: activeChat.avatar_color || '#6366f1' }}>
          {(activeChat.display_name || activeChat.displayName || '?').charAt(0).toUpperCase()}
          {isOnline && <span className="online-dot"></span>}
        </div>
        <div className="chat-header-info">
          <h3>{activeChat.display_name || activeChat.displayName}</h3>
          <span className={`status ${isOnline ? 'online' : ''}`}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      <div className="messages-container">
        {messages.length === 0 && (
          <div className="empty-messages">
            <p>No messages yet. Say hello!</p>
          </div>
        )}
        {messages.map((msg, idx) => {
          const isOwn = msg.fromUserId === user.id;
          const showTime = idx === 0 || messages[idx - 1].fromUserId !== msg.fromUserId;

          return (
            <div key={msg.id || idx} className={`message ${isOwn ? 'own' : 'other'}`}>
              <div className="message-bubble">
                {msg.content}
                <span className="msg-time">{formatTime(msg.createdAt)}</span>
              </div>
            </div>
          );
        })}
        {isTyping && (
          <div className="message other">
            <div className="message-bubble typing-bubble">
              <span className="typing-dots"><span></span><span></span><span></span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="message-input-area">
        <form className="input-form" onSubmit={handleSend}>
          <input
            className="message-input"
            type="text"
            placeholder={`Message ${activeChat.display_name || activeChat.displayName}...`}
            value={input}
            onChange={handleInput}
            onBlur={stopTyping}
          />
          <button type="submit" className="send-btn" disabled={!input.trim()}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChatView;
