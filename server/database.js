const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { app } = require('electron');

// Store database in user's app data directory
let dbPath;
try {
  dbPath = path.join(app.getPath('userData'), 'nexuschat.db');
} catch {
  // Fallback for when electron app isn't ready yet (testing)
  dbPath = path.join(__dirname, '..', 'nexuschat.db');
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_color TEXT DEFAULT '#6366f1',
    content TEXT NOT NULL,
    type TEXT DEFAULT 'text',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

function saveMessage({ username, displayName, avatarColor, content, type }) {
  const id = uuidv4();
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO messages (id, username, display_name, avatar_color, content, type, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, username, displayName, avatarColor || '#6366f1', content, type || 'text', createdAt);

  return { id, username, displayName, avatarColor, content, type, createdAt };
}

function getMessages(limit = 100) {
  return db.prepare(`
    SELECT id, username, display_name as displayName, avatar_color as avatarColor,
           content, type, created_at as createdAt
    FROM messages
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit).reverse();
}

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  db.prepare(`
    INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)
  `).run(key, value);
}

function close() {
  db.close();
}

module.exports = { saveMessage, getMessages, getSetting, setSetting, close };
