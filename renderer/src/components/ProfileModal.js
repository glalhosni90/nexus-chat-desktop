import React, { useState, useRef } from 'react';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6'];

function ProfileModal({ user, serverUrl, onUpdate, onClose }) {
  const [displayName, setDisplayName] = useState(user.displayName || user.display_name || '');
  const [avatarColor, setAvatarColor] = useState(user.avatarColor || user.avatar_color || '#6366f1');
  const [avatar, setAvatar] = useState(user.avatar || null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('userId', user.id);
    try {
      const res = await fetch(`${serverUrl}/api/profile/avatar`, { method: 'POST', body: formData });
      const data = await res.json();
      setAvatar(data.avatarUrl);
    } catch {}
    setUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${serverUrl}/api/profile/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, displayName, avatarColor })
      });
      const data = await res.json();
      onUpdate({ ...user, displayName, avatarColor, avatar });
    } catch {}
    setSaving(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal profile-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Profile</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="profile-content">
          <div className="profile-avatar-section">
            <div className="profile-avatar-wrapper" onClick={() => fileRef.current?.click()}>
              {avatar ? (
                <img src={avatar} alt="Avatar" className="profile-avatar-img" />
              ) : (
                <div className="profile-avatar-placeholder" style={{ background: avatarColor }}>
                  {(displayName || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="profile-avatar-overlay">
                {uploading ? '...' : 'Change'}
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
          </div>

          <div className="form-group">
            <label>Display Name</label>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" />
          </div>

          <div className="form-group">
            <label>Username</label>
            <input value={user.username} disabled className="disabled-input" />
          </div>

          <div className="form-group">
            <label>Avatar Color</label>
            <div className="color-picker">
              {COLORS.map(c => (
                <div
                  key={c}
                  className={`color-option ${avatarColor === c ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setAvatarColor(c)}
                />
              ))}
            </div>
          </div>

          <button className="auth-btn" onClick={handleSave} disabled={saving || !displayName.trim()}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfileModal;
