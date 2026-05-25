import { db } from './db.js';
import { addToQueue, removeFromQueue } from './matching.js';
import { moderateMessage } from './moderation.js';

// Keep track of active user rooms and details in memory
// roomId -> { userAId, userBId, isBot: boolean, requests: { [userId]: boolean }, contacts: { [userId]: string } }
const activeRooms = new Map();

// Helper to generate a room ID
const generateRoomId = () => `room_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

export function initSockets(io) {
  io.on('connection', (socket) => {
    let currentUserId = null;
    let currentRoomId = null;

    console.log(`[Socket] Client connected: ${socket.id}`);

    // Set active user ID associated with this socket
    socket.on('set-user', (userId) => {
      currentUserId = userId;
      console.log(`[Socket] Socket ${socket.id} mapped to User ${userId}`);
    });

    // Start matchmaking
    socket.on('search-match', async (user) => {
      if (!user || !user._id) return;
      currentUserId = user._id;

      // Make sure they are not already in an active room
      if (currentRoomId) {
        handleRoomDisconnect(io, socket, currentRoomId, currentUserId);
      }

      const match = await addToQueue(user, socket);

      if (match) {
        const roomId = generateRoomId();
        const { userA, userB, socketA, socketB, score } = match;

        // Register room in DB
        await db.createRoom(roomId, [userA._id, userB._id]);

        // Join socket rooms
        socketA.join(roomId);
        socketB.join(roomId);

        // Store active room session in memory
        activeRooms.set(roomId, {
          userAId: userA._id,
          userBId: userB._id,
          isBot: false,
          requests: { [userA._id]: false, [userB._id]: false },
          contacts: { [userA._id]: null, [userB._id]: null }
        });

        // Track user current rooms
        socketA.currentRoomId = roomId;
        socketB.currentRoomId = roomId;

        // Emit match success
        io.to(socketA.id).emit('match-found', { roomId, peer: userB, matchScore: score });
        io.to(socketB.id).emit('match-found', { roomId, peer: userA, matchScore: score });

        console.log(`[Matching] Room created: ${roomId} with score ${score} connecting ${userA.name} <-> ${userB.name}`);
      }
    });

    // Force Bot/Simulation Match for testing purposes
    socket.on('force-bot-match', async (user) => {
      if (!user || !user._id) return;
      currentUserId = user._id;

      if (currentRoomId) {
        handleRoomDisconnect(io, socket, currentRoomId, currentUserId);
      }

      // Remove from standard queue if present
      removeFromQueue(user._id);

      // Create a gorgeous mock profile for the bot based on user preferences
      const botGender = user.preference === 'Anyone' ? (Math.random() > 0.5 ? 'Female' : 'Male') : user.preference;
      
      const botNames = {
        Male: ['Aarav', 'Ethan', 'Lucas', 'Leo', 'Rohan', 'Kabir'],
        Female: ['Sophia', 'Zara', 'Elena', 'Ananya', 'Mia', 'Diya']
      };

      const botInterests = [
        ['coding', 'movies', 'music', 'gaming'],
        ['books', 'travel', 'anime', 'art'],
        ['music', 'movies', 'photography', 'food'],
        ['gaming', 'coding', 'fitness', 'tech']
      ];

      const chosenName = botNames[botGender][Math.floor(Math.random() * botNames[botGender].length)];
      const chosenInterests = botInterests[Math.floor(Math.random() * botInterests.length)];

      const botProfile = {
        _id: `bot_${Date.now()}`,
        name: `${chosenName} (AI Bot)`,
        gender: botGender,
        preference: user.gender,
        age: Math.max(18, user.age + (Math.floor(Math.random() * 5) - 2)),
        interests: chosenInterests,
        country: user.country || 'Global',
        isBot: true
      };

      // Register bot in DB
      await db.saveUser(botProfile);

      const roomId = generateRoomId();
      socket.join(roomId);
      currentRoomId = roomId;
      socket.currentRoomId = roomId;

      activeRooms.set(roomId, {
        userAId: user._id,
        userBId: botProfile._id,
        isBot: true,
        requests: { [user._id]: false, [botProfile._id]: false },
        contacts: { [user._id]: null, [botProfile._id]: `@${chosenName.toLowerCase()}_x` }
      });

      // Emit match found immediately
      socket.emit('match-found', {
        roomId,
        peer: botProfile,
        matchScore: 92 // High compatibility score
      });

      console.log(`[BotMatch] Created mock lobby session ${roomId} for User ${user.name}`);

      // Simulate an introductory message from the bot after 1.5 seconds
      setTimeout(() => {
        if (activeRooms.has(roomId)) {
          sendBotMessage(socket, roomId, `Hey there! I'm ${chosenName}. Let's chat! Glad we got matched! 😊 What are you up to?`);
        }
      }, 1500);
    });

    // Cancel Match search
    socket.on('cancel-match', () => {
      if (currentUserId) {
        removeFromQueue(currentUserId);
      }
    });

    // Real-Time Chat Message Handler
    socket.on('send-message', async ({ roomId, content, senderName }) => {
      if (!roomId || !content) return;
      currentRoomId = roomId;

      // Save user ID context
      if (!currentUserId) {
        console.warn(`[Socket] Received message without currentUserId`);
        return;
      }

      // Check Toxicity
      const modResult = await moderateMessage(content);

      if (modResult.flagged) {
        // Send a alert warnings only to the sender (highly visual!)
        socket.emit('message-moderated', {
          originalContent: content,
          reason: modResult.reason,
          score: modResult.score
        });

        console.log(`[Moderation] Blocked toxic message from user ${senderName}: "${content}" (${modResult.reason})`);
        return;
      }

      // Save message in database
      const msgObj = await db.saveMessage(roomId, {
        senderId: currentUserId,
        senderName,
        content
      });

      const roomSession = activeRooms.get(roomId);

      if (roomSession) {
        if (roomSession.isBot) {
          // If the room is with a bot, process bot conversational reply
          // Broadcast user message to user UI (since standard Socket.IO usually broadcasts to OTHERS)
          socket.emit('receive-message', msgObj);

          // Handle bot reply loop
          handleBotResponse(socket, roomId, content);
        } else {
          // Live user broadcast
          socket.to(roomId).emit('receive-message', msgObj);
          // Echo message back to sender to confirm delivery
          socket.emit('receive-message', msgObj);
        }
      }
    });

    // Typing Indicators
    socket.on('typing', ({ roomId, isTyping }) => {
      if (roomId) {
        socket.to(roomId).emit('typing', { isTyping });
      }
    });

    // Next Stranger (Disconnects current match and automatically search for the next)
    socket.on('next-stranger', () => {
      if (currentRoomId) {
        handleRoomDisconnect(io, socket, currentRoomId, currentUserId);
        currentRoomId = null;
      }
    });

    // WebRTC signaling forwards
    socket.on('webrtc-offer', ({ roomId, offer }) => {
      if (roomId) {
        socket.to(roomId).emit('webrtc-offer', { offer });
      }
    });

    socket.on('webrtc-answer', ({ roomId, answer }) => {
      if (roomId) {
        socket.to(roomId).emit('webrtc-answer', { answer });
      }
    });

    socket.on('webrtc-ice', ({ roomId, candidate }) => {
      if (roomId) {
        socket.to(roomId).emit('webrtc-ice', { candidate });
      }
    });

    // Secure Mutual Contact Exchange flow
    socket.on('request-contact', ({ roomId, contactDetail }) => {
      if (!roomId || !currentUserId) return;

      const room = activeRooms.get(roomId);
      if (!room) return;

      room.requests[currentUserId] = true;
      room.contacts[currentUserId] = contactDetail;

      // Broadcast request
      socket.to(roomId).emit('contact-requested', { senderId: currentUserId });
      console.log(`[ContactExchange] User ${currentUserId} requested contact exchange in room ${roomId}`);

      // If both accepted (in real user or bot)
      checkContactUnlock(socket, roomId);
    });

    // Report User
    socket.on('report-user', async ({ roomId, reportedId, reason }) => {
      if (currentUserId && reportedId) {
        await db.addReport(currentUserId, reportedId, reason);
        await db.blockUser(currentUserId, reportedId);
        
        console.log(`[Safety] User ${currentUserId} reported and blocked ${reportedId} for: ${reason}`);

        // Disconnect immediately
        if (roomId) {
          handleRoomDisconnect(io, socket, roomId, currentUserId);
        }
      }
    });

    // Block User
    socket.on('block-user', async ({ roomId, blockedId }) => {
      if (currentUserId && blockedId) {
        await db.blockUser(currentUserId, blockedId);
        
        console.log(`[Safety] User ${currentUserId} blocked ${blockedId}`);

        // Disconnect immediately
        if (roomId) {
          handleRoomDisconnect(io, socket, roomId, currentUserId);
        }
      }
    });

    // Disconnect Handler
    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
      if (currentUserId) {
        removeFromQueue(currentUserId);
      }
      if (currentRoomId) {
        handleRoomDisconnect(io, socket, currentRoomId, currentUserId);
      }
    });
  });
}

/**
 * Handles the mutual contact exchange verification
 */
function checkContactUnlock(socket, roomId) {
  const room = activeRooms.get(roomId);
  if (!room) return;

  const userIds = Object.keys(room.requests);
  if (userIds.length < 2) return;

  const userA = userIds[0];
  const userB = userIds[1];

  // If both approved the contact exchange
  if (room.requests[userA] === true && room.requests[userB] === true) {
    socket.emit('contact-revealed', {
      [userA]: room.contacts[userA],
      [userB]: room.contacts[userB]
    });
    
    socket.to(roomId).emit('contact-revealed', {
      [userA]: room.contacts[userA],
      [userB]: room.contacts[userB]
    });

    // Update rooms records in DB
    db.updateRoomContacts(roomId, userA, room.contacts[userA]);
    db.updateRoomContacts(roomId, userB, room.contacts[userB]);

    console.log(`[ContactExchange] Contacts mutual exchange SUCCESS in Room ${roomId}`);
  }
}

/**
 * Clean up active rooms and emit disconnect events to peers
 */
function handleRoomDisconnect(io, socket, roomId, userId) {
  const room = activeRooms.get(roomId);
  if (room) {
    console.log(`[Socket] User ${userId} is leaving room ${roomId}`);
    
    // Broadcast exit notify to the peer
    socket.to(roomId).emit('stranger-disconnected');
    
    // Remove from active socket room
    socket.leave(roomId);
    
    // Clean up cache
    activeRooms.delete(roomId);
  }
  
  if (socket.currentRoomId === roomId) {
    socket.currentRoomId = null;
  }
}

/**
 * Sends a chat message as a simulated AI Bot
 */
function sendBotMessage(socket, roomId, text) {
  const botMessage = {
    senderId: 'bot',
    senderName: 'Stranger (AI)',
    content: text,
    timestamp: new Date().toISOString()
  };

  db.saveMessage(roomId, botMessage);
  socket.emit('receive-message', botMessage);
}

/**
 * Interactive Conversational replies for the simulated matchmaking bot.
 */
function handleBotResponse(socket, roomId, userText) {
  const room = activeRooms.get(roomId);
  if (!room) return;

  // Simulate thinking (typing indicator) after 600ms
  setTimeout(() => {
    socket.emit('typing', { isTyping: true });

    // Generate responsive bot content based on text
    setTimeout(() => {
      socket.emit('typing', { isTyping: false });
      
      const normalized = userText.toLowerCase();
      let responseText = "That sounds super interesting! Tell me more. 😄";

      if (normalized.includes('hello') || normalized.includes('hey') || normalized.includes('hi')) {
        responseText = "Hey again! What interests you the most in tech or movies? 🎬💻";
      } else if (normalized.includes('interest') || normalized.includes('like') || normalized.includes('hobby')) {
        responseText = "Oh nice! I really love building web applications, watching thriller movies, and exploring new gaming maps. What's your absolute favorite hobby?";
      } else if (normalized.includes('code') || normalized.includes('program') || normalized.includes('react')) {
        responseText = "No way, you code too?! 💻 I've been styling everything with beautiful custom glassmorphic CSS variables lately. Do you prefer React or vanilla JS?";
      } else if (normalized.includes('movie') || normalized.includes('film') || normalized.includes('netflix')) {
        responseText = "Oh! I love movies! Highly recommend Christopher Nolan films like Interstellar. Have you seen it?";
      } else if (normalized.includes('game') || normalized.includes('gaming') || normalized.includes('xbox') || normalized.includes('playstation')) {
        responseText = "Yes! I game all the time. Minecraft, Valorant, and Elden Ring are my favorites. What's your setup like? 🎮";
      } else if (normalized.includes('where') || normalized.includes('live') || normalized.includes('country')) {
        responseText = "I'm connected globally but currently simulated from San Francisco! 🌉 Where are you chatting from?";
      } else if (normalized.includes('contact') || normalized.includes('snap') || normalized.includes('insta') || normalized.includes('whatsapp') || normalized.includes('exchange')) {
        responseText = "Let's definitely swap contacts! I just hit the 'Send Connection Request' button at the top of the chat. Click it and let's unlock! 🔐";
        
        // Auto trigger the bot contact request to match theirs!
        setTimeout(() => {
          room.requests[room.userBId] = true;
          socket.emit('contact-requested', { senderId: room.userBId });
          checkContactUnlock(socket, roomId);
        }, 1500);
      } else if (normalized.includes('toxic') || normalized.includes('stupid') || normalized.includes('hate')) {
        responseText = "Let's keep things polite and friendly here! The AI moderator is watching 🤖";
      }

      sendBotMessage(socket, roomId, responseText);
    }, 1200);
  }, 600);
}
