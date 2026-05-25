import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { Flame, ShieldCheck } from 'lucide-react';
import AuthScreen from './components/AuthScreen';
import ProfileSetup from './components/ProfileSetup';
import Lobby from './components/Lobby';
import ChatRoom from './components/ChatRoom';

let socketInstance = null;

export default function App() {
  const [userId, setUserId] = useState(null);
  const [user, setUser] = useState(null);
  const [view, setView] = useState('auth'); // 'auth' | 'profile' | 'lobby' | 'chat'
  const [roomDetails, setRoomDetails] = useState(null); // { roomId, peer, matchScore }
  const [onlineCount, setOnlineCount] = useState(1);

  // Initialize Socket.io connection when user logs in
  useEffect(() => {
    if (userId) {
      // Connect to Socket.IO backend server
      socketInstance = io('http://localhost:5000', {
        withCredentials: true,
        transports: ['websocket', 'polling']
      });

      socketInstance.on('connect', () => {
        console.log('[Socket] Connected to server successfully!');
        socketInstance.emit('set-user', userId);
      });

      // Match found event
      socketInstance.on('match-found', ({ roomId, peer, matchScore }) => {
        setRoomDetails({ roomId, peer, matchScore });
        setView('chat');
      });

      // Stats polling trigger
      const statsPoll = setInterval(async () => {
        try {
          const res = await fetch('http://localhost:5000/api/stats');
          if (res.ok) {
            const data = await res.json();
            // Offset stats slightly so it looks populated for local developer sandbox
            setOnlineCount(Math.max(1, data.onlineCount + 4));
          }
        } catch (err) {}
      }, 3000);

      return () => {
        clearInterval(statsPoll);
        if (socketInstance) {
          socketInstance.disconnect();
          socketInstance = null;
        }
      };
    }
  }, [userId]);

  const handleAuthSuccess = (uid) => {
    setUserId(uid);
    setView('profile');
  };

  const handleProfileComplete = (profileData) => {
    setUser(profileData);
    setView('lobby');
    
    // Start searching for human stranger matches
    if (socketInstance) {
      socketInstance.emit('search-match', profileData);
    }
  };

  const handleCancelMatch = () => {
    if (socketInstance) {
      socketInstance.emit('cancel-match');
    }
    setView('profile');
  };

  const handleForceBotMatch = () => {
    if (socketInstance) {
      socketInstance.emit('force-bot-match', user);
    }
  };

  const handleNextStranger = () => {
    if (socketInstance) {
      socketInstance.emit('next-stranger');
      // Transition back to lobby searching instantly
      setView('lobby');
      socketInstance.emit('search-match', user);
    }
  };

  return (
    <div style={styles.appWrapper}>
      {/* Decorative Orbs */}
      <div className="bg-glow-orbs">
        <div className="bg-orb orb-1" />
        <div className="bg-orb orb-2" />
      </div>

      {/* Modern Premium Navbar */}
      <header className="app-header">
        <div className="app-logo">
          <Flame size={26} style={{ color: 'var(--primary-light)' }} />
          <span>AnonMeet AI</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {userId && (
            <div className="online-tag">
              <span className="online-dot" />
              <span>{onlineCount} Online</span>
            </div>
          )}
          <div style={styles.safetyBadge}>
            <ShieldCheck size={14} style={{ color: 'var(--accent)' }} />
            <span>AI Moderated</span>
          </div>
        </div>
      </header>

      {/* Main Dynamic View Area */}
      <main style={styles.mainContainer}>
        {view === 'auth' && (
          <AuthScreen onAuthSuccess={handleAuthSuccess} />
        )}
        
        {view === 'profile' && (
          <ProfileSetup userId={userId} onProfileComplete={handleProfileComplete} />
        )}
        
        {view === 'lobby' && (
          <Lobby 
            user={user} 
            onCancel={handleCancelMatch} 
            onForceBot={handleForceBotMatch} 
          />
        )}
        
        {view === 'chat' && roomDetails && (
          <ChatRoom 
            socket={socketInstance} 
            user={user} 
            roomId={roomDetails.roomId} 
            peer={roomDetails.peer} 
            matchScore={roomDetails.matchScore} 
            onNext={handleNextStranger} 
          />
        )}
      </main>
    </div>
  );
}

const styles = {
  appWrapper: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    width: '100%',
    position: 'relative',
    zIndex: 1,
  },
  mainContainer: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    width: '100%',
  },
  safetyBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border-light)',
    padding: '0.35rem 0.85rem',
    borderRadius: 'var(--radius-full)',
  }
};
