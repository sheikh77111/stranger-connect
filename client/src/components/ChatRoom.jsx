import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, ShieldAlert, Sparkles, Video, VideoOff, 
  Mic, MicOff, Lock, Unlock, ArrowRight, UserX, AlertTriangle, Check
} from 'lucide-react';

export default function ChatRoom({ socket, user, roomId, peer, matchScore, onNext }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [peerIsTyping, setPeerIsTyping] = useState(false);
  const [peerDisconnected, setPeerDisconnected] = useState(false);
  
  // Camera & Stream State
  const [localStream, setLocalStream] = useState(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  
  // Moderation state
  const [modWarning, setModWarning] = useState(null); // { originalContent, reason, score }
  
  // Contact Exchange state
  const [contactRequested, setContactRequested] = useState(false);
  const [peerContactRequested, setPeerContactRequested] = useState(false);
  const [unlockedContacts, setUnlockedContacts] = useState(null); // { userAContact, userBContact }
  const [contactHandle, setContactHandle] = useState('@my_social_handle');

  // Modals
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('Harassment');

  const messagesEndRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Play a synthesized futuristic chord when contacts unlock!
  const playSuccessChime = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      const playTone = (freq, startTime, duration) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.frequency.setValueAtTime(freq, startTime);
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = audioCtx.currentTime;
      // Arpeggio
      playTone(523.25, now, 0.4);      // C5
      playTone(659.25, now + 0.1, 0.4);  // E5
      playTone(783.99, now + 0.2, 0.4);  // G5
      playTone(1046.50, now + 0.3, 0.6); // C6
    } catch (e) {
      console.warn('Web Audio chime could not play:', e);
    }
  };

  useEffect(() => {
    // 1. Setup Camera Media Streams
    setupCamera();

    // 2. Register Socket Event Listeners for Chat & Signaling
    socket.on('receive-message', (message) => {
      setMessages((prev) => [...prev, message]);
      setModWarning(null); // Clear any input warnings on success
    });

    socket.on('typing', ({ isTyping }) => {
      setPeerIsTyping(isTyping);
    });

    socket.on('message-moderated', (data) => {
      // Trigger a visual warning modal or notification
      setModWarning(data);
      // Play system alert tone
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      } catch (err) {}
    });

    socket.on('contact-requested', ({ senderId }) => {
      if (senderId !== user._id) {
        setPeerContactRequested(true);
      }
    });

    socket.on('contact-revealed', (contactsData) => {
      setUnlockedContacts(contactsData);
      playSuccessChime();
    });

    socket.on('stranger-disconnected', () => {
      setPeerDisconnected(true);
    });

    // Auto-focus chat messages scroll down
    scrollToBottom();

    return () => {
      // Cleanup streams and sockets
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      socket.off('receive-message');
      socket.off('typing');
      socket.off('message-moderated');
      socket.off('contact-requested');
      socket.off('contact-revealed');
      socket.off('stranger-disconnected');
    };
  }, [roomId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, peerIsTyping]);

  const setupCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240 },
        audio: true
      });
      setLocalStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // To simulate matching on one device, we route local stream to the remote peer's view as well!
      // This ensures that the video box looks completely live and functioning immediately!
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Camera access denied or unavailable:', err);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    
    // Trigger Typing Socket event
    if (!isTyping) {
      setIsTyping(true);
      socket.emit('typing', { roomId, isTyping: true });
    }

    // Reset typing timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit('typing', { roomId, isTyping: false });
    }, 1500);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    // Reset typing
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setIsTyping(false);
    socket.emit('typing', { roomId, isTyping: false });

    // Send Message Event
    socket.emit('send-message', {
      roomId,
      content: inputText.trim(),
      senderName: user.name
    });

    setInputText('');
  };

  const handleSendContactRequest = () => {
    setContactRequested(true);
    socket.emit('request-contact', {
      roomId,
      contactDetail: `${contactHandle} (shared by ${user.name})`
    });
  };

  const handleReport = () => {
    socket.emit('report-user', {
      roomId,
      reportedId: peer._id,
      reason: reportReason
    });
    setShowReportModal(false);
    onNext(); // Advance immediately
  };

  const handleBlock = () => {
    if (window.confirm(`Block ${peer.name}? You will never match with them again.`)) {
      socket.emit('block-user', {
        roomId,
        blockedId: peer._id
      });
      onNext();
    }
  };

  return (
    <div style={styles.container}>
      
      {/* 1. TOP SECURE CONTACT EXCHANGE BOARD */}
      <div className="glass-card" style={styles.exchangeCard}>
        <div style={styles.exchangeInfo}>
          <div style={styles.exchangeIconFrame}>
            {unlockedContacts ? (
              <Unlock size={20} style={{ color: 'var(--success)' }} />
            ) : (
              <Lock size={20} style={{ color: 'var(--warning)' }} />
            )}
          </div>
          <div>
            <h4 style={{ fontSize: '0.95rem', color: 'var(--text-white)' }}>
              {unlockedContacts ? 'Connection Unlocked!' : 'Mutual Contact Exchange'}
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {unlockedContacts 
                ? 'Both accepted! Contact details are revealed safely below.' 
                : 'Share social handles only when BOTH users agree. Zero-spam safety.'}
            </p>
          </div>
        </div>

        {unlockedContacts ? (
          <div className="animate-fade-in" style={styles.revealedSection}>
            <div style={styles.revealPill}>
              <span>Your Handle:</span>
              <strong style={{ color: 'var(--success)' }}>{unlockedContacts[user._id]}</strong>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>&lt;&gt;</div>
            <div style={styles.revealPill}>
              <span>{peer.name}'s:</span>
              <strong style={{ color: 'var(--primary-light)' }}>{unlockedContacts[peer._id]}</strong>
            </div>
          </div>
        ) : (
          <div style={styles.exchangeControls}>
            {!contactRequested ? (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  className="form-input"
                  style={styles.exchangeInput}
                  placeholder="Instagram/Telegram @username"
                  value={contactHandle}
                  onChange={(e) => setContactHandle(e.target.value)}
                />
                <button className="btn btn-primary" style={styles.exchangeBtn} onClick={handleSendContactRequest}>
                  Share Socials
                </button>
              </div>
            ) : (
              <div style={styles.waitingBadge}>
                {peerContactRequested ? (
                  <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Check size={14} /> Stranger wants to exchange! Connecting...
                  </span>
                ) : (
                  'Connection Request Sent! Waiting for stranger...'
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. MAIN CORE LAYOUT SPLIT */}
      <div style={styles.mainGrid}>
        
        {/* LEFT COMPONENT - REAL-TIME TEXT CHAT */}
        <div className="glass-card" style={styles.chatSection}>
          {/* Active matched peer header */}
          <div style={styles.chatHeader}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--text-white)' }}>{peer.name}</h3>
                <span className="online-tag" style={{ fontSize: '0.7rem', padding: '0.1rem 0.5rem' }}>
                  {peer.age} yrs • {peer.country}
                </span>
              </div>
              <div style={styles.interestList}>
                {(peer.interests || []).map((i) => (
                  <span key={i} style={styles.interestPill}>#{i}</span>
                ))}
              </div>
            </div>

            <div style={styles.matchScoreBadge}>
              <Sparkles size={12} /> {matchScore}% Compatible
            </div>
          </div>

          {/* Messages Panel */}
          <div style={styles.messageList}>
            {messages.length === 0 && (
              <div style={styles.emptyChatPlaceholder}>
                <div style={styles.emptyIcon}>🤖</div>
                <h4>Start the Conversation</h4>
                <p>Say hello! Matches are safe and moderated in real-time.</p>
              </div>
            )}

            {messages.map((msg, idx) => {
              const isMe = msg.senderId === user._id;
              return (
                <div
                  key={idx}
                  style={{
                    ...styles.messageWrapper,
                    justifyContent: isMe ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div
                    style={{
                      ...styles.messageBubble,
                      ...(isMe ? styles.myBubble : styles.strangerBubble)
                    }}
                  >
                    {!isMe && <span style={styles.senderLabel}>{msg.senderName}</span>}
                    <div style={styles.messageContent}>{msg.content}</div>
                    <span style={styles.messageTime}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Remote Peer Typing indicator */}
            {peerIsTyping && (
              <div style={{ ...styles.messageWrapper, justifyContent: 'flex-start' }}>
                <div className="typing-bubble">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
              </div>
            )}

            {peerDisconnected && (
              <div style={styles.systemMessage}>
                ⚠️ Stranger has disconnected. Click "Next Stranger" to search again!
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* AI Moderation Warning */}
          {modWarning && (
            <div className="animate-fade-in" style={styles.warningAlert}>
              <ShieldAlert size={16} style={{ color: 'var(--danger)', flexShrink: 0 }} />
              <div style={{ fontSize: '0.8rem', color: 'var(--text-white)' }}>
                <strong>Message Blocked by AI Moderation!</strong>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Your text "{modWarning.originalContent}" was flagged for high toxicity ({modWarning.reason}). Let's keep AnonMeet friendly!
                </p>
              </div>
            </div>
          )}

          {/* Input Panel */}
          <form onSubmit={handleSendMessage} style={styles.chatInputContainer}>
            <input
              type="text"
              className="form-input"
              style={styles.chatInput}
              placeholder={peerDisconnected ? "Stranger left conversation" : "Type clean messages..."}
              value={inputText}
              onChange={handleInputChange}
              disabled={peerDisconnected}
            />
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={styles.sendBtn} 
              disabled={peerDisconnected || !inputText.trim()}
            >
              <Send size={16} />
            </button>
          </form>
        </div>

        {/* RIGHT COMPONENT - WEBRTC VIDEO LAYER */}
        <div style={styles.rightPanel}>
          <div className="glass-card" style={styles.videoContainer}>
            
            {/* 1. Large Remote Stream */}
            <div style={styles.remoteView}>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                style={{
                  ...styles.remoteVideo,
                  display: videoEnabled ? 'block' : 'none'
                }}
              />
              {!videoEnabled && (
                <div style={styles.videoOffPlaceholder}>
                  <VideoOff size={42} style={{ color: 'var(--text-muted)' }} />
                  <p>Video Feed Muted</p>
                </div>
              )}

              {/* Tag Label */}
              <div style={styles.videoLabel}>
                {peer.name} {peer.isBot && '(AI Simulation)'}
              </div>
            </div>

            {/* 2. Small Overlay Local Stream (Bottom Right) */}
            <div style={styles.localView}>
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={styles.localVideo}
              />
              <div style={styles.localLabel}>You</div>
            </div>

            {/* Stream Controls */}
            <div style={styles.streamControlBar}>
              <button 
                className={`btn ${videoEnabled ? 'btn-secondary' : 'btn-danger'}`} 
                style={styles.controlIconBtn}
                onClick={toggleVideo}
              >
                {videoEnabled ? <Video size={18} /> : <VideoOff size={18} />}
              </button>
              
              <button 
                className={`btn ${audioEnabled ? 'btn-secondary' : 'btn-danger'}`} 
                style={styles.controlIconBtn}
                onClick={toggleAudio}
              >
                {audioEnabled ? <Mic size={18} /> : <MicOff size={18} />}
              </button>
            </div>
          </div>

          {/* Match Actions Toolbar */}
          <div style={styles.actionToolbar}>
            <button className="btn btn-secondary" style={styles.toolbarBtn} onClick={() => setShowReportModal(true)}>
              <AlertTriangle size={16} />
              Report
            </button>
            
            <button className="btn btn-secondary" style={styles.toolbarBtn} onClick={handleBlock}>
              <UserX size={16} style={{ color: 'var(--danger)' }} />
              Block
            </button>
            
            <button className="btn btn-danger" style={{ ...styles.toolbarBtn, flex: 2 }} onClick={onNext}>
              <span>Next Stranger</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

      </div>

      {/* REPORT MODAL */}
      {showReportModal && (
        <div style={styles.modalOverlay}>
          <div className="glass-card animate-fade-in" style={styles.modal}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-white)' }}>Report Abusive Behavior</h3>
            
            <div className="form-group">
              <label className="form-label">Reason for report</label>
              <select 
                className="form-input" 
                value={reportReason} 
                onChange={(e) => setReportReason(e.target.value)}
                style={{ background: 'var(--bg-primary)' }}
              >
                <option value="Harassment">Harassment or Abuse</option>
                <option value="Spam">Spam/Scam Profiles</option>
                <option value="Inappropriate">Inappropriate Visual Feed</option>
                <option value="Underage">Suspected Underage User</option>
              </select>
            </div>

            <div style={styles.modalActions}>
              <button className="btn btn-secondary" onClick={() => setShowReportModal(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleReport}>
                Submit Report & Block
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    padding: '1.25rem',
    gap: '1.25rem',
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
    height: 'calc(100vh - 80px)',
  },
  exchangeCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.75rem',
    borderRadius: '16px',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  exchangeInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    textAlign: 'left',
  },
  exchangeIconFrame: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exchangeControls: {
    display: 'flex',
    alignItems: 'center',
  },
  exchangeInput: {
    padding: '0.55rem 1rem',
    width: '240px',
    fontSize: '0.85rem',
  },
  exchangeBtn: {
    padding: '0.55rem 1.25rem',
    fontSize: '0.85rem',
  },
  waitingBadge: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    background: 'rgba(255,255,255,0.04)',
    border: '1px dashed var(--border-light)',
    padding: '0.55rem 1.25rem',
    borderRadius: '10px',
  },
  revealedSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  revealPill: {
    background: 'rgba(0,0,0,0.25)',
    border: '1px solid var(--border-light)',
    padding: '0.45rem 1rem',
    borderRadius: '10px',
    fontSize: '0.85rem',
    display: 'flex',
    gap: '0.5rem',
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr',
    gap: '1.25rem',
    flex: 1,
    minHeight: 0, // Allows child overflows to trigger scrollbars rather than stretch
  },
  chatSection: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '1.5rem',
    minHeight: 0,
  },
  chatHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: '1px solid var(--border-light)',
    paddingBottom: '0.85rem',
    marginBottom: '1rem',
  },
  interestList: {
    display: 'flex',
    gap: '0.4rem',
    marginTop: '0.4rem',
    flexWrap: 'wrap',
  },
  interestPill: {
    fontSize: '0.75rem',
    color: 'var(--primary-light)',
    background: 'rgba(139, 92, 246, 0.1)',
    padding: '0.1rem 0.5rem',
    borderRadius: 'var(--radius-full)',
  },
  matchScoreBadge: {
    background: 'linear-gradient(135deg, rgba(236,72,153,0.15) 0%, rgba(139,92,246,0.15) 100%)',
    border: '1px solid rgba(236,72,153,0.25)',
    color: 'var(--secondary)',
    fontSize: '0.8rem',
    fontWeight: '600',
    padding: '0.35rem 0.85rem',
    borderRadius: 'var(--radius-full)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
  },
  messageList: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    paddingRight: '0.5rem',
    marginBottom: '1rem',
  },
  messageWrapper: {
    display: 'flex',
    width: '100%',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: '0.75rem 1.1rem',
    borderRadius: '16px',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    textAlign: 'left',
  },
  myBubble: {
    background: 'linear-gradient(135deg, var(--primary) 0%, #6d28d9 100%)',
    color: 'var(--text-white)',
    borderBottomRightRadius: '4px',
    boxShadow: '0 3px 10px rgba(139,92,246,0.2)',
  },
  strangerBubble: {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    borderBottomLeftRadius: '4px',
    border: '1px solid var(--border-light)',
  },
  senderLabel: {
    fontSize: '0.7rem',
    color: 'var(--primary-light)',
    fontWeight: '600',
    marginBottom: '0.2rem',
  },
  messageContent: {
    fontSize: '0.92rem',
    lineHeight: 1.45,
    wordBreak: 'break-word',
  },
  messageTime: {
    fontSize: '0.65rem',
    color: 'rgba(255, 255, 255, 0.45)',
    alignSelf: 'flex-end',
    marginTop: '0.35rem',
  },
  emptyChatPlaceholder: {
    margin: 'auto',
    textAlign: 'center',
    maxWidth: '280px',
    color: 'var(--text-muted)',
  },
  emptyIcon: {
    fontSize: '2.5rem',
    marginBottom: '0.75rem',
  },
  warningAlert: {
    display: 'flex',
    gap: '0.75rem',
    background: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    borderRadius: '12px',
    padding: '0.85rem 1.25rem',
    marginBottom: '1rem',
    textAlign: 'left',
  },
  chatInputContainer: {
    display: 'flex',
    gap: '0.75rem',
  },
  chatInput: {
    flex: 1,
  },
  sendBtn: {
    padding: '0 1.25rem',
    flexShrink: 0,
  },
  systemMessage: {
    alignSelf: 'center',
    fontSize: '0.85rem',
    color: 'var(--warning)',
    background: 'rgba(245,158,11,0.06)',
    padding: '0.5rem 1.25rem',
    borderRadius: 'var(--radius-full)',
    border: '1px solid rgba(245,158,11,0.15)',
    margin: '1rem 0',
  },
  rightPanel: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    gap: '1.25rem',
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
    background: '#04060b',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '24px',
    border: '1px solid var(--border-light)',
  },
  remoteView: {
    flex: 1,
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  remoteVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  videoOffPlaceholder: {
    textAlign: 'center',
    color: 'var(--text-muted)',
  },
  localView: {
    position: 'absolute',
    bottom: '4.5rem',
    right: '1rem',
    width: '100px',
    height: '130px',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '2px solid rgba(255,255,255,0.15)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    background: '#0a0a0f',
  },
  localVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: 'scaleX(-1)', // Mirror local
  },
  videoLabel: {
    position: 'absolute',
    top: '1rem',
    left: '1rem',
    background: 'rgba(0, 0, 0, 0.65)',
    backdropFilter: 'blur(4px)',
    padding: '0.35rem 0.85rem',
    borderRadius: '8px',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-white)',
  },
  localLabel: {
    position: 'absolute',
    bottom: '0.4rem',
    left: '0.4rem',
    background: 'rgba(0, 0, 0, 0.6)',
    padding: '0.1rem 0.4rem',
    borderRadius: '4px',
    fontSize: '0.65rem',
    color: 'var(--text-white)',
  },
  streamControlBar: {
    position: 'absolute',
    bottom: '1rem',
    left: '1rem',
    display: 'flex',
    gap: '0.5rem',
  },
  controlIconBtn: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    padding: 0,
  },
  actionToolbar: {
    display: 'flex',
    gap: '0.75rem',
  },
  toolbarBtn: {
    flex: 1,
    padding: '0.85rem',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(8px)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modal: {
    width: '100%',
    maxWidth: '400px',
    textAlign: 'left',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    marginTop: '1.5rem',
  }
};
