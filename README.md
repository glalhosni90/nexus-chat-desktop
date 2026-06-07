# NexusChat Desktop

A standalone desktop chat application for local network (LAN) communication. Built with Electron + React, packaged as a single `.exe`.

## Features

- **Standalone** — no external server needed, everything runs inside the app
- **LAN Chat** — communicate with others on the same network
- **Host/Join** — one user hosts, others connect using the displayed IP:port
- **Real-time** — instant messaging with typing indicators via Socket.io
- **Message History** — messages are stored locally in SQLite
- **Modern UI** — dark theme with a Discord-like design
- **Online Users** — see who's connected in real-time

## Quick Start

### Development

```bash
# Install root dependencies
npm install

# Install renderer (React) dependencies
cd renderer && npm install && cd ..

# Run in development mode
npm run dev
```

### Build `.exe`

```bash
# Build for Windows
npm run build:win
```

The `.exe` installer will be generated in the `dist/` folder.

## How It Works

1. **Host mode**: Start the app and click "Start Chatting" — it launches an embedded server. Share the displayed IP:port with friends on the same network.
2. **Join mode**: Enter the host's IP:port address and connect.

## Tech Stack

- **Electron** — Desktop app framework
- **React** — UI library
- **Express + Socket.io** — Embedded real-time server
- **better-sqlite3** — Local message storage
- **electron-builder** — Packaging to `.exe`

## Project Structure

```
nexus-chat-desktop/
├── main.js              # Electron main process
├── preload.js           # Secure bridge between main/renderer
├── server/              # Embedded Express + Socket.io server
│   ├── index.js
│   └── database.js
├── renderer/            # React frontend
│   ├── src/
│   │   ├── App.js
│   │   ├── App.css
│   │   └── components/
│   │       ├── SetupScreen.js
│   │       └── ChatScreen.js
│   └── public/
└── package.json         # Electron + build config
```
