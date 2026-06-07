const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

let db = null;
let dbPath = null;

// Initialize database
async function initDatabase() {
  const SQL = await initSqlJs();

  // Store database in user's app data directory
  try {
    const { app } = require('electron');
    dbPath = path.join(app.getPath('userData'), 'nexuschat.db');
  } catch {
    dbPath = path.join(__dirname, '..', 'nexuschat.db');
  }

  // Load existing database or create new one
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      display_name TEXT NOT NULL,
      avatar_color TEXT DEFAULT '#6366f1',
      content TEXT NOT NULL,
      type TEXT DEFAULT 'text',
      created_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Save to disk
  saveToFile();
  return db;
}

function saveToFile() {
  if (db && dbPath) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

function saveMessage({ username, displayName, avatarColor, content, type }) {
  const id = uuidv4();
  const createdAt = new Date().toISOString();

  db.run(
    `INSERT INTO messages (id, username, display_name, avatar_color, content, type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, username, displayName, avatarColor || '#6366f1', content, type || 'text', createdAt]
  );

  saveToFile();
  return { id, username, displayName, avatarColor, content, type, createdAt };
}

function getMessages(limit = 100) {
  const stmt = db.prepare(
    `SELECT id, username, display_name as displayName, avatar_color as avatarColor,
            content, type, created_at as createdAt
     FROM messages
     ORDER BY created_at DESC
     LIMIT ?`
  );
  stmt.bind([limit]);

  const messages = [];
  while (stmt.step()) {
    messages.push(stmt.getAsObject());
  }
  stmt.free();

  return messages.reverse();
}

function getSetting(key) {
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  stmt.bind([key]);
  let result = null;
  if (stmt.step()) {
    result = stmt.getAsObject().value;
  }
  stmt.free();
  return result;
}

function setSetting(key, value) {
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  saveToFile();
}

function close() {
  if (db) {
    saveToFile();
    db.close();
  }
}

module.exports = { initDatabase, saveMessage, getMessages, getSetting, setSetting, close };
