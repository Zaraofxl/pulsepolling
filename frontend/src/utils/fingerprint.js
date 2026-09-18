// ============================================================================
// BROWSER CLIENT FINGERPRINT GENERATOR
// Creates a unique, non-invasive device token stored in localStorage
// combined with browser screen and navigator properties for deduplication.
// ============================================================================

export function getVoterFingerprint() {
  const STORAGE_KEY = 'pulsepoll_voter_token';
  
  // Step 1: Check existing persistent token in localStorage
  let voterToken = localStorage.getItem(STORAGE_KEY);
  if (voterToken) {
    return voterToken;
  }

  // Step 2: Synthesize browser attributes
  const screenData = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
  const navData = `${navigator.language || 'en'}-${navigator.userAgent || 'ua'}`;
  const randomSalt = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

  // Step 3: Generate simple hash token
  let hash = 0;
  const rawString = `${screenData}::${navData}::${randomSalt}`;
  for (let i = 0; i < rawString.length; i++) {
    const char = rawString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }

  voterToken = `vtr_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`;
  localStorage.setItem(STORAGE_KEY, voterToken);

  return voterToken;
}
