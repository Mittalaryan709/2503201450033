require('dotenv').config();

const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

const PORT = process.env.PORT || 4000;

// ── Middleware ────────────────────────────────────────────
app.use(express.json());

// Simple request logger (reuse concept from logging_middleware)
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// ── REST Routes ───────────────────────────────────────────
app.use('/api/v1/notifications', notificationRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'notification-app-be' }));

app.use((_req, res) => res.status(404).json({ success: false, error: 'Route not found' }));

// ── WebSocket ─────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  // Client sends { studentId } to join their private room
  socket.on('subscribe', ({ studentId }) => {
    if (!studentId) return;
    socket.join(`student:${studentId}`);
    console.log(`[WS] socket ${socket.id} subscribed to student:${studentId}`);
    socket.emit('subscribed', { studentId });
  });

  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

// Expose io so services can emit real-time events
app.set('io', io);

// ── Start ─────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\nNotification backend running on http://localhost:${PORT}`);
  console.log(`REST  → http://localhost:${PORT}/api/v1/notifications`);
  console.log(`Health→ http://localhost:${PORT}/health`);
  console.log(`WS    → ws://localhost:${PORT}\n`);
});

module.exports = { app, io };
