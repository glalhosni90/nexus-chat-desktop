import React, { useState, useRef, useEffect } from 'react';

function ChatView({ user, activeChat, messages, socket, isTyping, isOnline, onSendMessage, onUploadFile }) {
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [imageViewer, setImageViewer] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeout = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setReplyTo(null);
  }, [activeChat]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const reply = replyTo ? {
      id: replyTo.id,
      content: replyTo.type === 'image' || replyTo.type === 'file' ? '[File]' : replyTo.content,
      senderName: replyTo.fromUserId === user.id ? user.displayName : (activeChat.display_name || activeChat.displayName)
    } : null;
    onSendMessage(input, 'text', reply);
    setInput('');
    setReplyTo(null);
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

  const handleFileClick = () => fileInputRef.current?.click();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onUploadFile(file);
      e.target.value = '';
    }
  };

  const handleReply = (msg) => {
    setReplyTo(msg);
    inputRef.current?.focus();
  };

  const formatTime = (iso) => {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const downloadFile = (url, filename) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const renderReplyPreview = (msg) => {
    if (!msg.replyTo) return null;
    return (
      <div className="reply-preview">
        <span className="reply-sender">{msg.replyTo.senderName}</span>
        <span className="reply-text">{msg.replyTo.content}</span>
      </div>
    );
  };

  const renderMessageContent = (msg) => {
    if (msg.type === 'image' || msg.type === 'file') {
      try {
        const fileData = JSON.parse(msg.content);
        if (msg.type === 'image') {
          return (
            <div className="file-message">
              <img
                src={fileData.url}
                alt={fileData.filename}
                className="message-image"
                onClick={() => setImageViewer(fileData)}
              />
            </div>
          );
        } else {
          return (
            <div className="file-message">
              <div className="file-download" onClick={() => downloadFile(fileData.url, fileData.filename)}>
                <span className="file-icon">&#x1F4CE;</span>
                <span className="file-details">
                  <span className="file-name">{fileData.filename}</span>
                  <span className="file-size">{formatFileSize(fileData.size)}</span>
                </span>
                <span className="download-icon">&#x2B07;</span>
              </div>
            </div>
          );
        }
      } catch {
        return msg.content;
      }
    }
    return msg.content;
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
                {renderReplyPreview(msg)}
                {renderMessageContent(msg)}
                <span className="msg-time">{formatTime(msg.createdAt)}</span>
                <button className="reply-btn" onClick={() => handleReply(msg)} title="Reply">
                  &#x21A9;
                </button>
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
        {replyTo && (
          <div className="reply-bar">
            <div className="reply-bar-content">
              <span className="reply-bar-sender">
                Replying to {replyTo.fromUserId === user.id ? 'yourself' : (activeChat.display_name || activeChat.displayName)}
              </span>
              <span className="reply-bar-text">
                {replyTo.type === 'image' || replyTo.type === 'file' ? '[File]' : replyTo.content}
              </span>
            </div>
            <button className="reply-bar-close" onClick={() => setReplyTo(null)}>&times;</button>
          </div>
        )}
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
          />
          <input
            ref={inputRef}
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

      {/* Image Viewer Overlay */}
      {imageViewer && (
        <div className="image-viewer-overlay" onClick={() => setImageViewer(null)}>
          <div className="image-viewer" onClick={e => e.stopPropagation()}>
            <div className="image-viewer-header">
              <span className="image-viewer-name">{imageViewer.filename}</span>
              <div className="image-viewer-actions">
                <button onClick={() => downloadFile(imageViewer.url, imageViewer.filename)} title="Download">
                  &#x2B07; Download
                </button>
                <button onClick={() => setImageViewer(null)} title="Close">
                  &times;
                </button>
              </div>
            </div>
            <div className="image-viewer-body">
              <img src={imageViewer.url} alt={imageViewer.filename} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatView;
