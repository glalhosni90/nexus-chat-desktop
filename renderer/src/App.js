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

  // Use ref to track activeChat in socket handlers (avoid stale closure)
  const activeChatRef = useRef(null);
  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  const userRef = useRef(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Connect socket when user logs in
  useEffect(() => {
    if (!user) return;

    const newSocket = io(SERVER_URL, { transports: ['websocket', 'polling'] });

    newSocket.on('connect', () => {
      newSocket.emit('user:online', user.id);
    });

    newSocket.on('message:receive', (msg) => {
      const currentChat = activeChatRef.current;
      // If we're in the conversation with the sender, add message to view
      if (currentChat && currentChat.id === msg.fromUserId) {
        setMessages(prev => [...prev, msg]);
        // Mark as read since we're viewing
        newSocket.emit('messages:read', { fromUserId: msg.fromUserId });
      } else {
        // Not in this chat, increment unread
        setUnreadCounts(prev => ({
          ...prev,
          [msg.fromUserId]: (prev[msg.fromUserId] || 0) + 1
        }));
      }
      // Refresh contacts to update order
      loadContactsFn(userRef.current);
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

    newSocket.on('messages:read', ({ byUserId }) => {});

    newSocket.on('contacts:updated', () => {
      loadContactsFn(userRef.current);
    });

    setSocket(newSocket);
    loadContactsFn(user);
    loadUnreadFn(user);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  const loadContactsFn = async (u) => {
    if (!u) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/contacts/${u.id}`);
      const data = await res.json();
      setContacts(data);
    } catch {}
  };

  const loadUnreadFn = async (u) => {
    if (!u) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/messages/unread/${u.id}`);
      const data = await res.json();
      setUnreadCounts(data);
    } catch {}
  };

  const loadContacts = () => loadContactsFn(user);
  const loadUnread = () => loadUnreadFn(user);

  const openChat = async (contact) => {
    setActiveChat(contact);
    const res = await fetch(`${SERVER_URL}/api/messages/${user.id}/${contact.id}`);
    const data = await res.json();
    setMessages(data);
    setUnreadCounts(prev => ({ ...prev, [contact.id]: 0 }));
    if (socket) socket.emit('messages:read', { fromUserId: contact.id });
  };

  const sendMessage = (content, type = 'text', replyTo = null) => {
    if (!socket || !activeChat || !content.trim()) return;
    socket.emit('message:send', { toUserId: activeChat.id, content, type, replyTo });
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

  const handleUploadFile = async (file) => {
    if (!file || !activeChat) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fromUserId', user.id);
    formData.append('toUserId', activeChat.id);

    try {
      const res = await fetch(`${SERVER_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      // Message is broadcast via socket from server
    } catch (err) {
      console.error('Upload failed:', err);
    }
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
        onUploadFile={handleUploadFile}
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
