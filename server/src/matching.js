import { db } from './db.js';

// Queue stored in memory: array of objects { userId, socketId, socket, timestamp }
let matchingQueue = [];

/**
 * Adds a user to the matching queue and triggers immediate matching check.
 * Returns the match details if a match is found, otherwise null.
 */
export async function addToQueue(user, socket) {
  // Remove if already in queue
  removeFromQueue(user._id);

  const entry = {
    userId: user._id,
    socketId: socket.id,
    socket: socket,
    timestamp: Date.now()
  };

  matchingQueue.push(entry);
  console.log(`[Matching] User ${user.name} (${user.gender} -> wants ${user.preference}) added to queue. Queue size: ${matchingQueue.length}`);

  return findMatchForUser(entry);
}

/**
 * Removes a user from the matching queue.
 */
export function removeFromQueue(userId) {
  const initialLength = matchingQueue.length;
  matchingQueue = matchingQueue.filter(entry => entry.userId !== userId);
  if (matchingQueue.length < initialLength) {
    console.log(`[Matching] Removed user ${userId} from queue. Queue size: ${matchingQueue.length}`);
  }
}

/**
 * Checks compatibility between two users.
 */
export function isCompatible(u1, u2) {
  // 1. Gender / Preference compatibility
  const u1WantsU2 = u1.preference === 'Anyone' || u1.preference === u2.gender;
  const u2WantsU1 = u2.preference === 'Anyone' || u2.preference === u1.gender;

  return u1WantsU2 && u2WantsU1;
}

/**
 * Calculates a compatibility score (0 to 100).
 */
export function calculateMatchScore(u1, u2) {
  let score = 50; // Starting baseline

  // Age score: penalize age gaps
  const ageDifference = Math.abs(u1.age - u2.age);
  const agePenalty = ageDifference * 4; // 4 points per year difference
  score -= agePenalty;

  // Interest score: reward shared interests
  const interests1 = u1.interests || [];
  const interests2 = u2.interests || [];
  const commonInterests = interests1.filter(item => interests2.includes(item));
  score += commonInterests.length * 15; // 15 points per common interest

  // Country score: regional proximity reward
  if (u1.country && u2.country && u1.country === u2.country) {
    score += 15;
  }

  // Constrain between 0 and 100
  return Math.max(0, Math.min(100, score));
}

/**
 * Searches the queue for the best compatible match for a given queue entry.
 */
async function findMatchForUser(entry) {
  if (matchingQueue.length < 2) return null;

  const user = await db.getUser(entry.userId);
  if (!user) return null;

  let bestMatchEntry = null;
  let highestScore = -1;

  for (const candidate of matchingQueue) {
    if (candidate.userId === entry.userId) continue;

    // Check if either user blocked the other
    const blocked = await db.isBlocked(entry.userId, candidate.userId);
    if (blocked) continue;

    const candidateUser = await db.getUser(candidate.userId);
    if (!candidateUser) continue;

    if (isCompatible(user, candidateUser)) {
      const score = calculateMatchScore(user, candidateUser);
      if (score > highestScore) {
        highestScore = score;
        bestMatchEntry = candidate;
      }
    }
  }

  if (bestMatchEntry) {
    // Remove both from queue
    removeFromQueue(entry.userId);
    removeFromQueue(bestMatchEntry.userId);

    return {
      userA: user,
      userB: await db.getUser(bestMatchEntry.userId),
      socketA: entry.socket,
      socketB: bestMatchEntry.socket,
      score: highestScore
    };
  }

  return null;
}

/**
 * Gets the current size of the matchmaking queue.
 */
export function getQueueSize() {
  return matchingQueue.length;
}
