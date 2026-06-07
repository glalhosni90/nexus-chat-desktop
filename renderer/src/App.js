import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import SetupScreen from './components/SetupScreen';
import ChatScreen from './components/ChatScreen';
import './App.css';

function App() {
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const [user, setUser] = useState(null);
  const [serverUrl, setServerUrl] = useState('');
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [error, setError] = useState('');

  const connectToServer = (url, username, displayName, avatarColor) => {
    setError('');
    const newSocket = io(url, {
      transports: ['websocket', 'polling'],
      timeout: 5000,
    });

    newSocket.on('connect', () => {
      setConnected(true);
      setSocket(newSocket);
      setServerUrl(url);
      setUser({ username, displayName, avatarColor });

      newSocket.emit('user:join', { username, displayName, avatarColor });

      // Fetch existing messages
      fetch(`${url}/api/messages`)
        .then(r => r.json())
        .then(msgs => setMessages(msgs))
        .catch(() => {});
    });

    newSocket.on('connect_error', (err) => {
      setError('فشل الاتصال بالسيرفر. تأكد من العنوان.');
      newSocket.disconnect();
    });

    newSocket.on('message:new', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    newSocket.on('users:online', (users) => {
      setOnlineUsers(users);
    });

    newSocket.on('user:joined', (userData) => {
      // Could show notification
    });

    newSocket.on('user:left', (userData) => {
      setTypingUsers(prev => prev.filter(u => u.username !== userData.username));
    });

    newSocket.on('typing:start', ({ username, displayName }) => {
      setTypingUsers(prev => {
        if (prev.find(u => u.username === username)) return prev;
        return [...prev, { username, displayName }];
      });
    });

    newSocket.on('typing:stop', ({ username }) => {
      setTypingUsers(prev => prev.filter(u => u.username !== username));
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });
  };

  const disconnect = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setConnected(false);
      setMessages([]);
      setOnlineUsers([]);
      setTypingUsers([]);
    }
  };

  const sendMessage = (content) => {
    if (socket && content.trim()) {
      socket.emit('message:send', { content, type: 'text' });
    }
  };

  const startTyping = () => {
    if (socket) socket.emit('typing:start');
  };

  const stopTyping = () => {
    if (socket) socket.emit('typing:stop');
  };

  if (!connected) {
    return <SetupScreen onConnect={connectToServer} error={error} />;
  }

  return (
    <ChatScreen
      user={user}
      messages={messages}
      onlineUsers={onlineUsers}
      typingUsers={typingUsers}
      onSendMessage={sendMessage}
      onStartTyping={startTyping}
      onStopTyping={stopTyping}
      onDisconnect={disconnect}
      serverUrl={serverUrl}
    />
  );
}

export default App;
