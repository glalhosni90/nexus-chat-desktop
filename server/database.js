const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

let db = null;
let dbPath = null;

async function initDatabase() {
  const SQL = await initSqlJs();

  try {
    const { app } = require('electron');
    dbPath = path.join(app.getPath('userData'), 'nexuschat.db');
  } catch {
    dbPath = path.join(__dirname, '..', 'nexuschat.db');
  }

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      password TEXT NOT NULL,
      avatar_color TEXT DEFAULT '#6366f1',
      avatar TEXT DEFAULT NULL,
      bio TEXT DEFAULT '',
      status TEXT DEFAULT 'offline',
      created_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      contact_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, contact_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      from_user_id TEXT NOT NULL,
      to_user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'text',
      is_read INTEGER DEFAULT 0,
      reply_to_id TEXT DEFAULT NULL,
      reply_to_content TEXT DEFAULT NULL,
      reply_to_sender TEXT DEFAULT NULL,
      created_at TEXT NOT NULL
    )
  `);

  // Migrations: add columns if they don't exist (for existing DBs)
  try { db.run('ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT NULL'); } catch {}
  try { db.run('ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ""'); } catch {}
  try { db.run('ALTER TABLE messages ADD COLUMN reply_to_id TEXT DEFAULT NULL'); } catch {}
  try { db.run('ALTER TABLE messages ADD COLUMN reply_to_content TEXT DEFAULT NULL'); } catch {}
  try { db.run('ALTER TABLE messages ADD COLUMN reply_to_sender TEXT DEFAULT NULL'); } catch {}

  saveToFile();
  return db;
}

function saveToFile() {
  if (db && dbPath) {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  }
}

// --- Users ---
function createUser(username, displayName, password, avatarColor) {
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  try {
    db.run(
      `INSERT INTO users (id, username, display_name, password, avatar_color, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, username.toLowerCase(), displayName, password, avatarColor || '#6366f1', createdAt]
    );
    saveToFile();
    return { id, username: username.toLowerCase(), displayName, avatarColor, createdAt };
  } catch (e) {
    return null; // username already exists
  }
}

function getUserByUsername(username) {
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  stmt.bind([username.toLowerCase()]);
  let user = null;
  if (stmt.step()) user = stmt.getAsObject();
  stmt.free();
  return user;
}

function getUserById(id) {
  const stmt = db.prepare('SELECT id, username, display_name, avatar_color, avatar, bio, status, created_at FROM users WHERE id = ?');
  stmt.bind([id]);
  let user = null;
  if (stmt.step()) user = stmt.getAsObject();
  stmt.free();
  return user;
}

function updateProfile(userId, { displayName, avatarColor }) {
  const sets = [];
  const vals = [];
  if (displayName) { sets.push('display_name = ?'); vals.push(displayName); }
  if (avatarColor) { sets.push('avatar_color = ?'); vals.push(avatarColor); }
  if (sets.length === 0) return null;
  vals.push(userId);
  db.run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, vals);
  saveToFile();
  return getUserById(userId);
}

function updateAvatar(userId, avatarUrl) {
  db.run('UPDATE users SET avatar = ? WHERE id = ?', [avatarUrl, userId]);
  saveToFile();
}

function searchUsers(query) {
  const stmt = db.prepare(
    `SELECT id, username, display_name, avatar_color FROM users
     WHERE username LIKE ? OR display_name LIKE ? LIMIT 20`
  );
  const pattern = `%${query.toLowerCase()}%`;
  stmt.bind([pattern, pattern]);
  const results = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

function updateUserStatus(userId, status) {
  db.run('UPDATE users SET status = ? WHERE id = ?', [status, userId]);
  saveToFile();
}

// --- Contacts ---
function addContact(userId, contactId) {
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  try {
    db.run(
      'INSERT INTO contacts (id, user_id, contact_id, created_at) VALUES (?, ?, ?, ?)',
      [id, userId, contactId, createdAt]
    );
    // Add reverse too (mutual)
    db.run(
      'INSERT OR IGNORE INTO contacts (id, user_id, contact_id, created_at) VALUES (?, ?, ?, ?)',
      [uuidv4(), contactId, userId, createdAt]
    );
    saveToFile();
    return true;
  } catch {
    return false;
  }
}

function getContacts(userId) {
  const stmt = db.prepare(
    `SELECT u.id, u.username, u.display_name, u.avatar_color, u.avatar, u.status
     FROM contacts c JOIN users u ON c.contact_id = u.id
     WHERE c.user_id = ?
     ORDER BY u.display_name`
  );
  stmt.bind([userId]);
  const contacts = [];
  while (stmt.step()) contacts.push(stmt.getAsObject());
  stmt.free();
  return contacts;
}

function isContact(userId, contactId) {
  const stmt = db.prepare('SELECT id FROM contacts WHERE user_id = ? AND contact_id = ?');
  stmt.bind([userId, contactId]);
  const exists = stmt.step();
  stmt.free();
  return exists;
}

// --- Messages ---
function saveMessage(fromUserId, toUserId, content, type, replyTo) {
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  db.run(
    `INSERT INTO messages (id, from_user_id, to_user_id, content, type, reply_to_id, reply_to_content, reply_to_sender, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, fromUserId, toUserId, content, type || 'text',
     replyTo ? replyTo.id : null,
     replyTo ? replyTo.content : null,
     replyTo ? replyTo.senderName : null,
     createdAt]
  );
  saveToFile();
  return {
    id, fromUserId, toUserId, content, type: type || 'text', createdAt, is_read: 0,
    replyTo: replyTo ? { id: replyTo.id, content: replyTo.content, senderName: replyTo.senderName } : null
  };
}

function getConversation(userId1, userId2, limit = 50) {
  const stmt = db.prepare(
    `SELECT id, from_user_id as fromUserId, to_user_id as toUserId, content, type, is_read,
            reply_to_id, reply_to_content, reply_to_sender,
            created_at as createdAt
     FROM messages
     WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)
     ORDER BY created_at DESC LIMIT ?`
  );
  stmt.bind([userId1, userId2, userId2, userId1, limit]);
  const messages = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    if (row.reply_to_id) {
      row.replyTo = { id: row.reply_to_id, content: row.reply_to_content, senderName: row.reply_to_sender };
    } else {
      row.replyTo = null;
    }
    delete row.reply_to_id;
    delete row.reply_to_content;
    delete row.reply_to_sender;
    messages.push(row);
  }
  stmt.free();
  return messages.reverse();
}

function markAsRead(fromUserId, toUserId) {
  db.run(
    'UPDATE messages SET is_read = 1 WHERE from_user_id = ? AND to_user_id = ? AND is_read = 0',
    [fromUserId, toUserId]
  );
  saveToFile();
}

function getUnreadCounts(userId) {
  const stmt = db.prepare(
    `SELECT from_user_id as fromUserId, COUNT(*) as count
     FROM messages WHERE to_user_id = ? AND is_read = 0
     GROUP BY from_user_id`
  );
  stmt.bind([userId]);
  const counts = {};
  while (stmt.step()) {
    const row = stmt.getAsObject();
    counts[row.fromUserId] = row.count;
  }
  stmt.free();
  return counts;
}

function getLastMessages(userId) {
  const stmt = db.prepare(
    `SELECT m.* FROM messages m
     INNER JOIN (
       SELECT
         CASE WHEN from_user_id = ? THEN to_user_id ELSE from_user_id END as other_user,
         MAX(created_at) as max_time
       FROM messages
       WHERE from_user_id = ? OR to_user_id = ?
       GROUP BY other_user
     ) latest ON m.created_at = latest.max_time
     AND (
       (m.from_user_id = ? AND m.to_user_id = latest.other_user) OR
       (m.to_user_id = ? AND m.from_user_id = latest.other_user)
     )
     ORDER BY m.created_at DESC`
  );
  stmt.bind([userId, userId, userId, userId, userId]);
  const messages = [];
  while (stmt.step()) messages.push(stmt.getAsObject());
  stmt.free();
  return messages;
}

function close() {
  if (db) {
    saveToFile();
    db.close();
  }
}

module.exports = {
  initDatabase, close,
  createUser, getUserByUsername, getUserById, searchUsers, updateUserStatus,
  updateProfile, updateAvatar,
  addContact, getContacts, isContact,
  saveMessage, getConversation, markAsRead, getUnreadCounts, getLastMessages
};
