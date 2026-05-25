import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');

// Ensure database directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');

// Initialize database files if empty or not present
const initFile = (filePath, defaultData = []) => {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf-8');
  }
};

initFile(USERS_FILE, []);
initFile(ROOMS_FILE, []);
initFile(REPORTS_FILE, []);

// Helper to read JSON data safely
const readJson = (filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return [];
  }
};

// Helper to write JSON data safely
const writeJson = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error writing to ${filePath}:`, err);
  }
};

export const db = {
  // USER OPERATIONS
  async getUser(userId) {
    const users = readJson(USERS_FILE);
    return users.find(u => u._id === userId) || null;
  },

  async saveUser(user) {
    const users = readJson(USERS_FILE);
    const existingIndex = users.findIndex(u => u._id === user._id);
    
    // Add default values if missing
    const userData = {
      _id: user._id,
      name: user.name || 'Anonymous',
      gender: user.gender || 'Anyone',
      preference: user.preference || 'Anyone',
      age: parseInt(user.age, 10) || 20,
      interests: user.interests || [],
      country: user.country || 'Unknown',
      blocks: user.blocks || [],
      createdAt: user.createdAt || new Date().toISOString(),
      lastActive: new Date().toISOString()
    };

    if (existingIndex > -1) {
      users[existingIndex] = { ...users[existingIndex], ...userData };
    } else {
      users.push(userData);
    }
    writeJson(USERS_FILE, users);
    return userData;
  },

  async updateUser(userId, data) {
    const users = readJson(USERS_FILE);
    const index = users.findIndex(u => u._id === userId);
    if (index > -1) {
      users[index] = { ...users[index], ...data, lastActive: new Date().toISOString() };
      writeJson(USERS_FILE, users);
      return users[index];
    }
    return null;
  },

  async deleteUser(userId) {
    let users = readJson(USERS_FILE);
    users = users.filter(u => u._id !== userId);
    writeJson(USERS_FILE, users);
    return true;
  },

  // CHAT ROOM OPERATIONS
  async createRoom(roomId, usersArray) {
    const rooms = readJson(ROOMS_FILE);
    const newRoom = {
      roomId,
      users: usersArray, // array of userIds
      messages: [],
      contactsShared: {
        [usersArray[0]]: null,
        [usersArray[1]]: null
      },
      createdAt: new Date().toISOString()
    };
    rooms.push(newRoom);
    writeJson(ROOMS_FILE, rooms);
    return newRoom;
  },

  async getRoom(roomId) {
    const rooms = readJson(ROOMS_FILE);
    return rooms.find(r => r.roomId === roomId) || null;
  },

  async saveMessage(roomId, message) {
    const rooms = readJson(ROOMS_FILE);
    const index = rooms.findIndex(r => r.roomId === roomId);
    if (index > -1) {
      const msgObj = {
        senderId: message.senderId,
        senderName: message.senderName || 'Stranger',
        content: message.content,
        timestamp: new Date().toISOString(),
        flagged: message.flagged || false,
        reason: message.reason || null
      };
      rooms[index].messages.push(msgObj);
      writeJson(ROOMS_FILE, rooms);
      return msgObj;
    }
    return null;
  },

  async updateRoomContacts(roomId, userId, contactDetail) {
    const rooms = readJson(ROOMS_FILE);
    const index = rooms.findIndex(r => r.roomId === roomId);
    if (index > -1) {
      if (!rooms[index].contactsShared) {
        rooms[index].contactsShared = {};
      }
      rooms[index].contactsShared[userId] = contactDetail;
      writeJson(ROOMS_FILE, rooms);
      return rooms[index];
    }
    return null;
  },

  // REPORT & BLOCK SYSTEMS
  async addReport(reporterId, reportedId, reason) {
    const reports = readJson(REPORTS_FILE);
    const newReport = {
      reportId: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      reporterId,
      reportedId,
      reason,
      timestamp: new Date().toISOString()
    };
    reports.push(newReport);
    writeJson(REPORTS_FILE, reports);
    return newReport;
  },

  async blockUser(userId, blockedId) {
    const users = readJson(USERS_FILE);
    const index = users.findIndex(u => u._id === userId);
    if (index > -1) {
      if (!users[index].blocks) {
        users[index].blocks = [];
      }
      if (!users[index].blocks.includes(blockedId)) {
        users[index].blocks.push(blockedId);
      }
      writeJson(USERS_FILE, users);
      return users[index];
    }
    return null;
  },

  async isBlocked(userId, checkId) {
    const user = await this.getUser(userId);
    const targetUser = await this.getUser(checkId);
    
    const userBlocks = user?.blocks || [];
    const targetBlocks = targetUser?.blocks || [];

    return userBlocks.includes(checkId) || targetBlocks.includes(userId);
  }
};
