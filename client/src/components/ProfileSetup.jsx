import React, { useState } from 'react';
import { User, Globe, Compass, ArrowRight, Heart } from 'lucide-react';

const INTERESTS_PRESETS = [
  'coding', 'movies', 'music', 'gaming', 'anime', 
  'travel', 'books', 'art', 'fitness', 'cooking', 'tech', 'photography'
];

export default function ProfileSetup({ userId, onProfileComplete }) {
  const [name, setName] = useState('');
  const [gender, setGender] = useState('Male');
  const [preference, setPreference] = useState('Anyone');
  const [age, setAge] = useState(21);
  const [country, setCountry] = useState('India');
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleInterest = (interest) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interest));
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (age < 18) {
      setError('You must be 18 or older to use AnonMeet');
      return;
    }
    setError('');
    setLoading(true);

    const profileData = {
      _id: userId,
      name: name.trim(),
      gender,
      preference,
      age: parseInt(age, 10),
      interests: selectedInterests,
      country: country.trim()
    };

    try {
      const response = await fetch('http://localhost:5000/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      });

      if (response.ok) {
        const data = await response.json();
        onProfileComplete(data.user);
      } else {
        setError('Failed to update profile. Please try again.');
      }
    } catch (err) {
      console.error('Error posting profile:', err);
      // Fallback: Continue with local data if backend server is starting up
      onProfileComplete(profileData);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div className="glass-card animate-fade-in" style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.title}>Configure Profile</h2>
          <p style={styles.subtitle}>Setup your anonymous persona to find compatible matches.</p>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.row}>
            {/* Name */}
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">Persona Name</label>
              <div style={styles.inputContainer}>
                <User size={16} style={styles.inputIcon} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder="Rahul / Anonymous"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={15}
                  required
                />
              </div>
            </div>

            {/* Age */}
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Age</label>
              <input
                type="number"
                min={18}
                max={100}
                className="form-input"
                value={age}
                onChange={(e) => setAge(parseInt(e.target.value, 10) || 18)}
                required
              />
            </div>
          </div>

          <div style={styles.row}>
            {/* Country */}
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Country</label>
              <div style={styles.inputContainer}>
                <Globe size={16} style={styles.inputIcon} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder="India"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Gender Toggles */}
          <div className="form-group">
            <label className="form-label">Your Gender</label>
            <div style={styles.toggleGroup}>
              {['Male', 'Female', 'Other'].map((g) => (
                <button
                  key={g}
                  type="button"
                  style={{
                    ...styles.toggleBtn,
                    ...(gender === g ? styles.toggleBtnActive : {})
                  }}
                  onClick={() => setGender(g)}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Preference Toggles */}
          <div className="form-group">
            <label className="form-label">Match Preference</label>
            <div style={styles.toggleGroup}>
              {['Male', 'Female', 'Anyone'].map((p) => (
                <button
                  key={p}
                  type="button"
                  style={{
                    ...styles.toggleBtn,
                    ...(preference === p ? styles.toggleBtnActivePreference : {})
                  }}
                  onClick={() => setPreference(p)}
                >
                  <Heart size={14} style={{ fill: preference === p ? 'currentColor' : 'none' }} />
                  {p === 'Anyone' ? 'Anyone' : `Wants ${p}`}
                </button>
              ))}
            </div>
          </div>

          {/* Interests badge select */}
          <div className="form-group">
            <label className="form-label">Interests (Select all that apply)</label>
            <div className="badge-selector" style={{ marginTop: '0.5rem' }}>
              {INTERESTS_PRESETS.map((interest) => {
                const isSelected = selectedInterests.includes(interest);
                return (
                  <button
                    key={interest}
                    type="button"
                    className={`badge-tag ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleInterest(interest)}
                  >
                    {interest}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1rem', padding: '0.9rem' }}
            disabled={loading}
          >
            {loading ? 'Saving Profile...' : 'Save & Launch Lobby'}
            <ArrowRight size={18} />
          </button>
        </form>
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
    maxWidth: '520px',
  },
  header: {
    marginBottom: '1.75rem',
    textAlign: 'center',
  },
  title: {
    fontSize: '1.5rem',
    color: 'var(--text-white)',
    marginBottom: '0.5rem',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    lineHeight: 1.4,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  row: {
    display: 'flex',
    gap: '1rem',
  },
  inputContainer: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '0.85rem',
    color: 'var(--text-muted)',
  },
  toggleGroup: {
    display: 'flex',
    gap: '0.65rem',
  },
  toggleBtn: {
    flex: 1,
    padding: '0.65rem',
    borderRadius: '10px',
    border: '1px solid var(--border-light)',
    background: 'rgba(0, 0, 0, 0.2)',
    color: 'var(--text-primary)',
    fontWeight: '500',
    fontSize: '0.9rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    transition: 'all 0.2s ease',
  },
  toggleBtnActive: {
    background: 'var(--bg-tertiary)',
    borderColor: 'var(--primary)',
    color: 'var(--primary-light)',
    boxShadow: '0 0 10px rgba(139, 92, 246, 0.15)',
  },
  toggleBtnActivePreference: {
    background: 'rgba(236, 72, 153, 0.1)',
    borderColor: 'var(--secondary)',
    color: 'var(--secondary)',
    boxShadow: '0 0 10px rgba(236, 72, 153, 0.15)',
  },
  error: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: '#f87171',
    padding: '0.75rem',
    borderRadius: '10px',
    fontSize: '0.85rem',
    marginBottom: '1.25rem',
  }
};
