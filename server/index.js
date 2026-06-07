const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const db = require('./database');

let server = null;
let io = null;

const onlineUsers = new Map(); // userId -> socketId

function hashPassword(pw) {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

async function startServer(port) {
  await db.initDatabase();
  const listenPort = port || process.env.PORT || 3001;

  return new Promise((resolve, reject) => {
    const app = express();
    app.use(cors());
    app.use(express.json());

    // Serve static frontend
    const buildPath = path.join(__dirname, '..', 'renderer', 'build');
    app.use(express.static(buildPath));

    // --- FILE UPLOAD SETUP ---
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const storage = multer.diskStorage({
      destination: uploadsDir,
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
      }
    });
    const upload = multer({ storage });
    app.use('/uploads', express.static(uploadsDir));

    // --- AUTH ---
    app.post('/api/register', (req, res) => {
      const { username, displayName, password, avatarColor } = req.body;
      if (!username || !displayName || !password) {
        return res.status(400).json({ error: 'All fields required' });
      }
      if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: 'Username must be 3-20 characters' });
      }
      const user = db.createUser(username, displayName, hashPassword(password), avatarColor);
      if (!user) return res.status(409).json({ error: 'Username already taken' });
      res.json({ user });
    });

    app.post('/api/login', (req, res) => {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }
      const user = db.getUserByUsername(username);
      if (!user || user.password !== hashPassword(password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      res.json({
        user: { id: user.id, username: user.username, displayName: user.display_name, avatarColor: user.avatar_color }
      });
    });

    // Verify user session
    app.get('/api/verify/:userId', (req, res) => {
      const user = db.getUserById(req.params.userId);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json({ user: { id: user.id, username: user.username, displayName: user.display_name, avatarColor: user.avatar_color, avatar: user.avatar } });
    });

    // Update profile
    app.post('/api/profile/update', (req, res) => {
      const { userId, displayName, avatarColor } = req.body;
      if (!userId) return res.status(400).json({ error: 'Missing userId' });
      const updated = db.updateProfile(userId, { displayName, avatarColor });
      if (!updated) return res.status(404).json({ error: 'User not found' });
      res.json({ user: updated });
    });

    // Upload avatar
    app.post('/api/profile/avatar', upload.single('avatar'), (req, res) => {
      if (!req.file) return res.status(400).json({ error: 'No file' });
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: 'Missing userId' });
      const avatarUrl = `/uploads/${req.file.filename}`;
      db.updateAvatar(userId, avatarUrl);
      res.json({ avatarUrl });
    });

    // --- USERS ---
    app.get('/api/users/search', (req, res) => {
      const { q } = req.query;
      if (!q || q.length < 1) return res.json([]);
      const results = db.searchUsers(q);
      res.json(results);
    });

    // --- CONTACTS ---
    app.get('/api/contacts/:userId', (req, res) => {
      const contacts = db.getContacts(req.params.userId);
      res.json(contacts);
    });

    app.post('/api/contacts/add', (req, res) => {
      const { userId, contactId } = req.body;
      if (!userId || !contactId) return res.status(400).json({ error: 'Missing fields' });
      if (userId === contactId) return res.status(400).json({ error: 'Cannot add yourself' });
      const success = db.addContact(userId, contactId);
      if (!success) return res.status(409).json({ error: 'Already a contact' });

      // Notify both users via socket to refresh contacts
      const adderSocket = onlineUsers.get(userId);
      const addedSocket = onlineUsers.get(contactId);
      if (adderSocket) io.to(adderSocket).emit('contacts:updated');
      if (addedSocket) io.to(addedSocket).emit('contacts:updated');

      res.json({ success: true });
    });

    // --- MESSAGES ---
    app.get('/api/messages/:userId/:contactId', (req, res) => {
      const { userId, contactId } = req.params;
      const messages = db.getConversation(userId, contactId);
      db.markAsRead(contactId, userId);
      res.json(messages);
    });

    app.get('/api/messages/unread/:userId', (req, res) => {
      const counts = db.getUnreadCounts(req.params.userId);
      res.json(counts);
    });

    // --- FILE UPLOAD ENDPOINT ---

    app.post('/api/upload', upload.single('file'), (req, res) => {
      if (!req.file) return res.status(400).json({ error: 'No file' });
      const { fromUserId, toUserId } = req.body;
      if (!fromUserId || !toUserId) return res.status(400).json({ error: 'Missing user IDs' });

      const fileUrl = `/uploads/${req.file.filename}`;
      const isImage = req.file.mimetype.startsWith('image/');
      const content = JSON.stringify({
        url: fileUrl,
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
      });

      const message = db.saveMessage(fromUserId, toUserId, content, isImage ? 'image' : 'file');

      // Send via socket to recipient
      const recipientSocket = onlineUsers.get(toUserId);
      if (recipientSocket) {
        io.to(recipientSocket).emit('message:receive', message);
      }
      // Send back to sender
      const senderSocket = onlineUsers.get(fromUserId);
      if (senderSocket) {
        io.to(senderSocket).emit('message:sent', message);
      }

      res.json(message);
    });

    // Health
    app.get('/health', (req, res) => res.json({ status: 'ok' }));

    // SPA fallback
    app.get('*', (req, res) => {
      const indexPath = path.join(buildPath, 'index.html');
      if (require('fs').existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).json({ error: 'Not found' });
      }
    });

    server = http.createServer(app);
    io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

    io.on('connection', (socket) => {
      // User goes online
      socket.on('user:online', (userId) => {
        socket.userId = userId;
        onlineUsers.set(userId, socket.id);
        db.updateUserStatus(userId, 'online');
        io.emit('user:status', { userId, status: 'online' });
      });

      // Private message
      socket.on('message:send', ({ toUserId, content, type, replyTo }) => {
        if (!socket.userId) return;
        const message = db.saveMessage(socket.userId, toUserId, content, type, replyTo || null);
        // Send to recipient if online
        const recipientSocket = onlineUsers.get(toUserId);
        if (recipientSocket) {
          io.to(recipientSocket).emit('message:receive', message);
        }
        // Confirm to sender
        socket.emit('message:sent', message);
      });

      // Typing
      socket.on('typing:start', ({ toUserId }) => {
        const recipientSocket = onlineUsers.get(toUserId);
        if (recipientSocket) {
          io.to(recipientSocket).emit('typing:start', { fromUserId: socket.userId });
        }
      });

      socket.on('typing:stop', ({ toUserId }) => {
        const recipientSocket = onlineUsers.get(toUserId);
        if (recipientSocket) {
          io.to(recipientSocket).emit('typing:stop', { fromUserId: socket.userId });
        }
      });

      // Mark messages as read
      socket.on('messages:read', ({ fromUserId }) => {
        if (!socket.userId) return;
        db.markAsRead(fromUserId, socket.userId);
        const senderSocket = onlineUsers.get(fromUserId);
        if (senderSocket) {
          io.to(senderSocket).emit('messages:read', { byUserId: socket.userId });
        }
      });

      // --- WebRTC Signaling ---
      socket.on('call:initiate', ({ toUserId, callType }) => {
        const recipientSocket = onlineUsers.get(toUserId);
        if (recipientSocket) {
          io.to(recipientSocket).emit('call:incoming', {
            fromUserId: socket.userId,
            callType // 'audio' or 'video'
          });
        } else {
          socket.emit('call:unavailable', { toUserId });
        }
      });

      socket.on('call:accept', ({ toUserId }) => {
        const callerSocket = onlineUsers.get(toUserId);
        if (callerSocket) io.to(callerSocket).emit('call:accepted', { fromUserId: socket.userId });
      });

      socket.on('call:reject', ({ toUserId }) => {
        const callerSocket = onlineUsers.get(toUserId);
        if (callerSocket) io.to(callerSocket).emit('call:rejected', { fromUserId: socket.userId });
      });

      socket.on('call:end', ({ toUserId }) => {
        const otherSocket = onlineUsers.get(toUserId);
        if (otherSocket) io.to(otherSocket).emit('call:ended', { fromUserId: socket.userId });
      });

      socket.on('webrtc:offer', ({ toUserId, offer }) => {
        const recipientSocket = onlineUsers.get(toUserId);
        if (recipientSocket) io.to(recipientSocket).emit('webrtc:offer', { fromUserId: socket.userId, offer });
      });

      socket.on('webrtc:answer', ({ toUserId, answer }) => {
        const recipientSocket = onlineUsers.get(toUserId);
        if (recipientSocket) io.to(recipientSocket).emit('webrtc:answer', { fromUserId: socket.userId, answer });
      });

      socket.on('webrtc:ice-candidate', ({ toUserId, candidate }) => {
        const recipientSocket = onlineUsers.get(toUserId);
        if (recipientSocket) io.to(recipientSocket).emit('webrtc:ice-candidate', { fromUserId: socket.userId, candidate });
      });

      // Disconnect
      socket.on('disconnect', () => {
        if (socket.userId) {
          onlineUsers.delete(socket.userId);
          db.updateUserStatus(socket.userId, 'offline');
          io.emit('user:status', { userId: socket.userId, status: 'offline' });
        }
      });
    });

    server.listen(listenPort, '0.0.0.0', () => {
      const addr = server.address();
      console.log(`NexusChat server running on port ${addr.port}`);
      resolve({ port: addr.port, host: '0.0.0.0' });
    });

    server.on('error', reject);
  });
}

function stopServer() {
  if (io) io.close();
  if (server) server.close();
  db.close();
}

if (require.main === module) {
  startServer().then(info => {
    console.log(`Server started on port ${info.port}`);
  }).catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { startServer, stopServer };
