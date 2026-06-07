import React from 'react';

function Sidebar({ user, contacts, activeChat, unreadCounts, onlineStatuses, onSelectChat, onShowSearch, onShowProfile, onLogout }) {
  const getInitial = (name) => name ? name.charAt(0).toUpperCase() : '?';

  const renderAvatar = (avatarUrl, color, name, size = 42) => {
    if (avatarUrl) {
      return <img src={avatarUrl} alt="" className="avatar-img" style={{ width: size, height: size }} />;
    }
    return (
      <div className="avatar-letter" style={{ background: color || '#6366f1', width: size, height: size, fontSize: size * 0.4 }}>
        {getInitial(name)}
      </div>
    );
  };

  return (
    <div className="sidebar">
      <div className="sidebar-top">
        <div className="sidebar-user">
          <div className="sidebar-avatar-wrap" onClick={onShowProfile}>
            {renderAvatar(user.avatar, user.avatarColor || user.avatar_color, user.displayName, 40)}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user.displayName}</span>
            <span className="sidebar-user-status">Online</span>
          </div>
          <button className="icon-btn" onClick={onShowProfile} title="Profile">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          </button>
          <button className="icon-btn logout" onClick={onLogout} title="Logout">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
          </button>
        </div>

        <div className="sidebar-search-bar" onClick={onShowSearch}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="search-svg"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <span className="search-placeholder">Search users...</span>
        </div>
      </div>

      <div className="contacts-header">
        <span>Messages</span>
        <button className="add-btn" onClick={onShowSearch} title="Add Contact">+</button>
      </div>

      <div className="contacts-list">
        {contacts.length === 0 && (
          <div className="empty-contacts">
            <p>No conversations yet</p>
            <p className="hint">Search for people to start chatting</p>
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
              <div className="contact-avatar-wrap">
                {renderAvatar(contact.avatar, contact.avatar_color, contact.display_name)}
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
