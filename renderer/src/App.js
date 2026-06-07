import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import AuthScreen from './components/AuthScreen';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import SearchModal from './components/SearchModal';
import './App.css';

const SERVER_URL = window.location.origin;

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('nexuschat_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [socket, setSocket] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [onlineStatuses, setOnlineStatuses] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const [showSearch, setShowSearch] = useState(false);

  // Connect socket when user logs in
  useEffect(() => {
    if (!user) return;

    const newSocket = io(SERVER_URL, { transports: ['websocket', 'polling'] });

    newSocket.on('connect', () => {
      newSocket.emit('user:online', user.id);
    });

    newSocket.on('message:receive', (msg) => {
      setMessages(prev => {
        if (prev.length > 0 && (prev[0].fromUserId === msg.fromUserId || prev[0].toUserId === msg.fromUserId)) {
          return [...prev, msg];
        }
        return prev;
      });
      setUnreadCounts(prev => ({
        ...prev,
        [msg.fromUserId]: (prev[msg.fromUserId] || 0) + 1
      }));
      loadContacts();
    });

    newSocket.on('message:sent', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    newSocket.on('user:status', ({ userId, status }) => {
      setOnlineStatuses(prev => ({ ...prev, [userId]: status }));
    });

    newSocket.on('typing:start', ({ fromUserId }) => {
      setTypingUsers(prev => ({ ...prev, [fromUserId]: true }));
    });

    newSocket.on('typing:stop', ({ fromUserId }) => {
      setTypingUsers(prev => ({ ...prev, [fromUserId]: false }));
    });

    newSocket.on('messages:read', ({ byUserId }) => {
      // Messages were read by the other user
    });

    setSocket(newSocket);
    loadContacts();
    loadUnread();

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  const loadContacts = useCallback(async () => {
    if (!user) return;
    const res = await fetch(`${SERVER_URL}/api/contacts/${user.id}`);
    const data = await res.json();
    setContacts(data);
  }, [user]);

  const loadUnread = useCallback(async () => {
    if (!user) return;
    const res = await fetch(`${SERVER_URL}/api/messages/unread/${user.id}`);
    const data = await res.json();
    setUnreadCounts(data);
  }, [user]);

  const openChat = async (contact) => {
    setActiveChat(contact);
    const res = await fetch(`${SERVER_URL}/api/messages/${user.id}/${contact.id}`);
    const data = await res.json();
    setMessages(data);
    // Clear unread for this contact
    setUnreadCounts(prev => ({ ...prev, [contact.id]: 0 }));
    if (socket) socket.emit('messages:read', { fromUserId: contact.id });
  };

  const sendMessage = (content) => {
    if (!socket || !activeChat || !content.trim()) return;
    socket.emit('message:send', { toUserId: activeChat.id, content, type: 'text' });
  };

  const handleLogin = (userData) => {
    localStorage.setItem('nexuschat_user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('nexuschat_user');
    if (socket) socket.disconnect();
    setUser(null);
    setSocket(null);
    setContacts([]);
    setMessages([]);
    setActiveChat(null);
  };

  const handleAddContact = async (contactId) => {
    await fetch(`${SERVER_URL}/api/contacts/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, contactId })
    });
    loadContacts();
    setShowSearch(false);
  };

  if (!user) {
    return <AuthScreen onLogin={handleLogin} serverUrl={SERVER_URL} />;
  }

  return (
    <div className="app-layout">
      <Sidebar
        user={user}
        contacts={contacts}
        activeChat={activeChat}
        unreadCounts={unreadCounts}
        onlineStatuses={onlineStatuses}
        onSelectChat={openChat}
        onShowSearch={() => setShowSearch(true)}
        onLogout={handleLogout}
      />
      <ChatView
        user={user}
        activeChat={activeChat}
        messages={messages}
        socket={socket}
        isTyping={activeChat ? typingUsers[activeChat.id] : false}
        isOnline={activeChat ? onlineStatuses[activeChat.id] === 'online' : false}
        onSendMessage={sendMessage}
      />
      {showSearch && (
        <SearchModal
          serverUrl={SERVER_URL}
          currentUserId={user.id}
          contacts={contacts}
          onAdd={handleAddContact}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  );
}

export default App;
