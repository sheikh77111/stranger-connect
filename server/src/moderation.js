import dotenv from 'dotenv';
dotenv.config();

// Sleek local profanity and toxicity detector in case Perspective API key is not present
const BANNED_WORDS = [
  'abuse', 'fuck', 'shit', 'asshole', 'bitch', 'bastard', 'cunt', 'dick', 'cock', 'faggot', 
  'nigger', 'retard', 'slut', 'whore', 'kill yourself', 'kys', 'die', 'hate you'
];

const TOXIC_PATTERNS = [
  /\b(fuck|shit|bitch|bastard|cunt|dick|cock|faggot|nigger|retard|slut|whore)\b/i,
  /\bkill\s+your\s*self\b/i,
  /\b(kys|die\s+in\s+a\s+fire|you\s+are\s+trash)\b/i,
  /\b(stupid|idiot|moron|loser|ugly|fat)\s+piece\s+of\b/i
];

/**
 * Moderates a message.
 * Returns { flagged: boolean, score: number, reason: string|null }
 */
export async function moderateMessage(text) {
  if (!text || typeof text !== 'string') {
    return { flagged: false, score: 0, reason: null };
  }

  // 1. If Perspective API key is provided, attempt to use it
  const apiKey = process.env.PERSPECTIVE_API_KEY;
  if (apiKey) {
    try {
      const response = await fetch(
        `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            comment: { text },
            languages: ['en'],
            requestedAttributes: { TOXICITY: {}, SEVERE_TOXICITY: {}, INSULT: {}, PROFANITY: {} }
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        const toxicityScore = data.attributeScores.TOXICITY.summaryValue.value;
        const insultScore = data.attributeScores.INSULT.summaryValue.value;
        const profanityScore = data.attributeScores.PROFANITY.summaryValue.value;

        const maxScore = Math.max(toxicityScore, insultScore, profanityScore);

        if (maxScore > 0.7) {
          let reason = 'Toxicity';
          if (profanityScore > 0.7) reason = 'Profanity';
          else if (insultScore > 0.7) reason = 'Insult';

          return {
            flagged: true,
            score: parseFloat(maxScore.toFixed(2)),
            reason: `AI flagged this message for high ${reason}`
          };
        }
        return { flagged: false, score: parseFloat(maxScore.toFixed(2)), reason: null };
      }
    } catch (err) {
      console.warn('Perspective API analysis failed, falling back to local model:', err.message);
    }
  }

  // 2. Local fallback model (lexicon + pattern matching)
  const normalizedText = text.toLowerCase().trim();
  
  // Pattern checks
  let flagged = false;
  let reason = null;
  let score = 0;

  for (const pattern of TOXIC_PATTERNS) {
    if (pattern.test(normalizedText)) {
      flagged = true;
      score = 0.85;
      reason = 'Flagged: Contains abusive or profane terms';
      break;
    }
  }

  // Exact word matches
  if (!flagged) {
    const words = normalizedText.split(/\s+/);
    const bannedMatch = words.filter(word => BANNED_WORDS.includes(word));
    if (bannedMatch.length > 0) {
      flagged = true;
      score = 0.75 + (bannedMatch.length * 0.05);
      reason = 'Flagged: Profanity detected';
    }
  }

  // CAPS scream toxicity heuristic
  if (!flagged && text.length > 8) {
    const letters = text.replace(/[^A-Za-z]/g, '');
    const caps = text.replace(/[^A-Z]/g, '');
    if (letters.length > 6 && caps.length / letters.length > 0.85) {
      // Screaming could be aggressive
      score = 0.45;
    }
  }

  // Bound score
  score = Math.min(score, 1.0);

  return {
    flagged,
    score,
    reason: flagged ? reason : null
  };
}
