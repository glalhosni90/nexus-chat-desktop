import React, { useState } from 'react';

function SearchModal({ serverUrl, currentUserId, contacts, onAdd, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async (val) => {
    setQuery(val);
    if (val.trim().length < 1) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`${serverUrl}/api/users/search?q=${encodeURIComponent(val)}`);
      const data = await res.json();
      // Filter out self
      setResults(data.filter(u => u.id !== currentUserId));
    } catch {
      setResults([]);
    }
    setSearching(false);
  };

  const isAlreadyContact = (userId) => {
    return contacts.some(c => c.id === userId);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Find People</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-search">
          <input
            type="text"
            placeholder="Search by username or name..."
            value={query}
            onChange={e => handleSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="modal-results">
          {searching && <div className="searching">Searching...</div>}
          {!searching && results.length === 0 && query.length > 0 && (
            <div className="no-results">No users found</div>
          )}
          {results.map(user => (
            <div key={user.id} className="search-result-item">
              <div className="result-avatar" style={{ background: user.avatar_color || '#6366f1' }}>
                {(user.display_name || user.username).charAt(0).toUpperCase()}
              </div>
              <div className="result-info">
                <span className="result-name">{user.display_name}</span>
                <span className="result-username">@{user.username}</span>
              </div>
              {isAlreadyContact(user.id) ? (
                <span className="already-added">Added</span>
              ) : (
                <button className="add-contact-btn" onClick={() => onAdd(user.id)}>
                  Add
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SearchModal;
