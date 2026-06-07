const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const db = require('./database');

let server = null;
let io = null;

const onlineUsers = new Map(); // username -> { socketId, displayName, avatarColor }

async function startServer(port) {
  // Initialize database first
  await db.initDatabase();

  // Use provided port, or PORT env, or 3001
  const listenPort = port || process.env.PORT || 3001;

  return new Promise((resolve, reject) => {
    const app = express();
    app.use(cors());
    app.use(express.json());

    // Serve static frontend in production
    const buildPath = path.join(__dirname, '..', 'renderer', 'build');
    app.use(express.static(buildPath));

    // Health check
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', app: 'NexusChat Desktop' });
    });

    // Get all messages for a room
    app.get('/api/messages', (req, res) => {
      const limit = parseInt(req.query.limit) || 100;
      const messages = db.getMessages(limit);
      res.json(messages);
    });

    // Get online users
    app.get('/api/users/online', (req, res) => {
      const users = [];
      onlineUsers.forEach((info, username) => {
        users.push({ username, displayName: info.displayName, avatarColor: info.avatarColor });
      });
      res.json(users);
    });

    // Fallback to index.html for SPA routing
    app.get('*', (req, res) => {
      const indexPath = path.join(buildPath, 'index.html');
      if (require('fs').existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).json({ error: 'Not found' });
      }
    });

    server = http.createServer(app);
    io = new Server(server, {
      cors: { origin: '*', methods: ['GET', 'POST'] }
    });

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // User joins
      socket.on('user:join', ({ username, displayName, avatarColor }) => {
        socket.username = username;
        socket.displayName = displayName;
        socket.avatarColor = avatarColor;

        onlineUsers.set(username, { socketId: socket.id, displayName, avatarColor });

        // Broadcast user joined
        io.emit('user:joined', { username, displayName, avatarColor });
        io.emit('users:online', getOnlineUsersList());
      });

      // Message send
      socket.on('message:send', ({ content, type }) => {
        if (!socket.username) return;

        const message = db.saveMessage({
          username: socket.username,
          displayName: socket.displayName,
          avatarColor: socket.avatarColor,
          content,
          type: type || 'text',
        });

        // Broadcast to all
        io.emit('message:new', message);
      });

      // Typing indicators
      socket.on('typing:start', () => {
        if (!socket.username) return;
        socket.broadcast.emit('typing:start', {
          username: socket.username,
          displayName: socket.displayName,
        });
      });

      socket.on('typing:stop', () => {
        if (!socket.username) return;
        socket.broadcast.emit('typing:stop', { username: socket.username });
      });

      // Disconnect
      socket.on('disconnect', () => {
        if (socket.username) {
          onlineUsers.delete(socket.username);
          io.emit('user:left', { username: socket.username, displayName: socket.displayName });
          io.emit('users:online', getOnlineUsersList());
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

function getOnlineUsersList() {
  const users = [];
  onlineUsers.forEach((info, username) => {
    users.push({ username, displayName: info.displayName, avatarColor: info.avatarColor });
  });
  return users;
}

function stopServer() {
  if (io) io.close();
  if (server) server.close();
  db.close();
}

// Allow running standalone (not just from Electron)
if (require.main === module) {
  startServer().then(info => {
    console.log(`Server started on port ${info.port}`);
  }).catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { startServer, stopServer };
