import React, { useState, useRef, useEffect } from 'react';

function ChatView({ user, activeChat, messages, socket, isTyping, isOnline, onSendMessage, onUploadFile }) {
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
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

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onUploadFile(file);
      e.target.value = '';
    }
  };

  const formatTime = (iso) => {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessageContent = (msg) => {
    if (msg.type === 'image' || msg.type === 'file') {
      try {
        const fileData = JSON.parse(msg.content);
        if (msg.type === 'image') {
          return (
            <div className="file-message">
              <img src={fileData.url} alt={fileData.filename} className="message-image" />
              <span className="file-name">{fileData.filename}</span>
            </div>
          );
        } else {
          return (
            <div className="file-message">
              <a href={fileData.url} target="_blank" rel="noopener noreferrer" className="file-download">
                <span className="file-icon">&#x1F4CE;</span>
                <span className="file-details">
                  <span className="file-name">{fileData.filename}</span>
                  <span className="file-size">{formatFileSize(fileData.size)}</span>
                </span>
              </a>
            </div>
          );
        }
      } catch {
        return msg.content;
      }
    }
    return msg.content;
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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
            {isTyping ? 'Typing...' : (isOnline ? 'Online' : 'Offline')}
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

          return (
            <div key={msg.id || idx} className={`message ${isOwn ? 'own' : 'other'}`}>
              <div className="message-bubble">
                {renderMessageContent(msg)}
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
          <button type="button" className="attach-btn" onClick={handleFileClick} title="Send file">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={handleFileChange}
            accept="image/*,.pdf,.doc,.docx,.txt,.zip,.rar"
          />
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
