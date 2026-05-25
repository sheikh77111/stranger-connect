import React, { useState, useEffect } from 'react';
import { Compass, Users, Sparkles, AlertCircle } from 'lucide-react';

export default function Lobby({ user, onCancel, onForceBot }) {
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [stats, setStats] = useState({ onlineCount: 1, queueSize: 1 });

  useEffect(() => {
    // Search Timer
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);

    // Initial fetch of server stats
    fetchStats();

    // Stats polling every 2.5 seconds
    const statsInterval = setInterval(fetchStats, 2500);

    return () => {
      clearInterval(timer);
      clearInterval(statsInterval);
    };
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/stats');
      if (res.ok) {
        const data = await res.json();
        // Add default offsets so stats look realistic and active for demo
        setStats({
          onlineCount: Math.max(1, data.onlineCount + 4), 
          queueSize: Math.max(1, data.queueSize)
        });
      }
    } catch (err) {
      // Fallback offline mock stats
      setStats({ onlineCount: 8, queueSize: 1 });
    }
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  return (
    <div style={styles.container}>
      <div className="glass-card animate-fade-in" style={styles.card}>
        
        {/* Pulsing Match Circle */}
        <div style={styles.pulseContainer}>
          <div style={styles.outerRing}>
            <div style={styles.innerRing}>
              <Compass style={styles.compassIcon} className="animate-spin-slow" />
            </div>
          </div>
        </div>

        <h2 style={styles.title}>Searching for Strangers...</h2>
        
        <p style={styles.preferenceDescription}>
          Matching <strong>{user.name}</strong> ({user.gender}) with someone who matches preference{' '}
          <strong style={{ color: 'var(--secondary)' }}>{user.preference === 'Anyone' ? 'Anyone' : user.preference}</strong>.
        </p>

        {/* Dynamic timer display */}
        <div style={styles.timerBadge}>
          Time Elapsed: {formatTime(secondsElapsed)}
        </div>

        {/* Server Real-time stats display */}
        <div style={styles.statsPanel}>
          <div style={styles.statItem}>
            <Users size={16} style={{ color: 'var(--accent)' }} />
            <span><b>{stats.onlineCount}</b> Online</span>
          </div>
          <div style={styles.statSeparator} />
          <div style={styles.statItem}>
            <Sparkles size={16} style={{ color: 'var(--warning)' }} />
            <span><b>{stats.queueSize}</b> Matching</span>
          </div>
        </div>

        {/* Demo Warning & Force Bot Match Banner */}
        {secondsElapsed >= 4 && (
          <div className="animate-fade-in" style={styles.demoBanner}>
            <AlertCircle size={16} style={{ color: 'var(--warning)', flexShrink: 0 }} />
            <div style={styles.demoBannerText}>
              Testing locally? Click below to instantly pair with an interactive AI stranger conversational bot.
            </div>
          </div>
        )}

        <div style={styles.actions}>
          <button className="btn btn-secondary" style={styles.actionBtn} onClick={onCancel}>
            Cancel Matching
          </button>
          
          <button className="btn btn-primary" style={styles.actionBtn} onClick={onForceBot}>
            <Sparkles size={16} />
            Force Bot Match
          </button>
        </div>

      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    padding: '2rem 1rem',
  },
  card: {
    width: '100%',
    maxWidth: '460px',
    textAlign: 'center',
  },
  pulseContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '2rem',
  },
  outerRing: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    background: 'rgba(139, 92, 246, 0.05)',
    border: '2px dashed rgba(139, 92, 246, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'pulse-ring 2.5s infinite ease-in-out',
  },
  innerRing: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'rgba(139, 92, 246, 0.1)',
    border: '1px solid rgba(139, 92, 246, 0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 20px rgba(139, 92, 246, 0.2)',
  },
  compassIcon: {
    color: 'var(--primary-light)',
    width: '36px',
    height: '36px',
  },
  title: {
    fontSize: '1.45rem',
    color: 'var(--text-white)',
    marginBottom: '0.75rem',
  },
  preferenceDescription: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
    lineHeight: 1.5,
    marginBottom: '1.25rem',
  },
  timerBadge: {
    display: 'inline-block',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)',
    padding: '0.45rem 1.25rem',
    borderRadius: 'var(--radius-full)',
    fontSize: '0.85rem',
    fontWeight: '600',
    marginBottom: '1.5rem',
  },
  statsPanel: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: 'rgba(0, 0, 0, 0.2)',
    border: '1px solid var(--border-light)',
    borderRadius: '12px',
    padding: '0.75rem 1.25rem',
    marginBottom: '1.5rem',
    gap: '1rem',
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.85rem',
    color: 'var(--text-primary)',
  },
  statSeparator: {
    width: '1px',
    height: '16px',
    background: 'var(--border-light)',
  },
  demoBanner: {
    background: 'rgba(245, 158, 11, 0.08)',
    border: '1px solid rgba(245, 158, 11, 0.15)',
    borderRadius: '10px',
    padding: '0.75rem 1rem',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    marginBottom: '1.5rem',
    textAlign: 'left',
  },
  demoBannerText: {
    fontSize: '0.8rem',
    color: 'var(--warning)',
    lineHeight: 1.4,
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  actionBtn: {
    width: '100%',
  }
};
