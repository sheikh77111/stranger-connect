import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { db } from './db.js';
import { initSockets } from './socket.js';
import { getQueueSize } from './matching.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Middleware
app.use(cors({
  origin: FRONTEND_URL,
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());

// Socket.io initialization
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000
});

// Track total active sockets
let onlineCount = 0;
io.on('connection', (socket) => {
  onlineCount++;
  socket.on('disconnect', () => {
    onlineCount = Math.max(0, onlineCount - 1);
  });
});

// REST API Endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// Profile Management Endpoint
app.post('/api/profile', async (req, res) => {
  try {
    const { _id, name, gender, preference, age, interests, country } = req.body;
    
    if (!_id) {
      return res.status(400).json({ error: 'User ID (_id) is required' });
    }

    const savedUser = await db.saveUser({
      _id,
      name,
      gender,
      preference,
      age: parseInt(age, 10),
      interests,
      country
    });

    res.status(200).json({ success: true, user: savedUser });
  } catch (error) {
    console.error('Error saving profile:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/profile/:id', async (req, res) => {
  try {
    const user = await db.getUser(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Analytics/Stats Endpoint for frontend lobby
app.get('/api/stats', (req, res) => {
  res.json({
    onlineCount: onlineCount,
    queueSize: getQueueSize(),
    timestamp: new Date().toISOString()
  });
});

// Initialize socket events
initSockets(io);

// Start server
server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`  AnonMeet AI Backend Server is live!`);
  console.log(`  Port: http://localhost:${PORT}`);
  console.log(`  Database Mode: ${process.env.DATABASE_MODE || 'json'}`);
  console.log(`===============================================`);
});
