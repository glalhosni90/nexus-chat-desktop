import React from 'react';

function Sidebar({ user, contacts, activeChat, unreadCounts, onlineStatuses, onSelectChat, onShowSearch, onLogout }) {
  const getInitial = (name) => name ? name.charAt(0).toUpperCase() : '?';

  return (
    <div className="sidebar">
      <div className="sidebar-top">
        <div className="sidebar-user">
          <div className="sidebar-avatar" style={{ background: user.avatarColor || '#6366f1' }}>
            {getInitial(user.displayName)}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user.displayName}</span>
            <span className="sidebar-user-status">Online</span>
          </div>
          <button className="logout-btn" onClick={onLogout} title="Logout">
            &#x2192;
          </button>
        </div>

        <div className="sidebar-search-bar" onClick={onShowSearch}>
          <span className="search-icon">&#x1F50D;</span>
          <span className="search-placeholder">Search users...</span>
        </div>
      </div>

      <div className="contacts-header">
        <span>Conversations</span>
        <button className="add-btn" onClick={onShowSearch} title="Add Contact">+</button>
      </div>

      <div className="contacts-list">
        {contacts.length === 0 && (
          <div className="empty-contacts">
            <p>No contacts yet</p>
            <p className="hint">Click search to find people</p>
          </div>
        )}
        {contacts.map(contact => {
          const isOnline = onlineStatuses[contact.id] === 'online' || contact.status === 'online';
          const unread = unreadCounts[contact.id] || 0;
          const isActive = activeChat && activeChat.id === contact.id;

          return (
            <div
              key={contact.id}
              className={`contact-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectChat(contact)}
            >
              <div className="contact-avatar" style={{ background: contact.avatar_color || '#6366f1' }}>
                {getInitial(contact.display_name)}
                {isOnline && <span className="online-dot"></span>}
              </div>
              <div className="contact-info">
                <span className="contact-name">{contact.display_name}</span>
                <span className="contact-username">@{contact.username}</span>
              </div>
              {unread > 0 && <span className="unread-badge">{unread}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Sidebar;
