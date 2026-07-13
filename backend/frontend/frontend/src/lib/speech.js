/**
 * Speech pacing helpers for the voice interview: detecting when a candidate
 * is still thinking, and splitting interviewer replies into sentences for
 * natural sentence-pipelined TTS.
 */

// Filler / hesitation patterns at the TAIL of the running transcript.
// If the user just said one of these, they're thinking — extend the silence
// threshold instead of treating the pause as "done talking".
export const FILLER_TAIL =
  /\b(um+|uh+|hmm+|er+|ah+|let me (think|see|try)|give me a (sec|second|moment)|hold on|one (sec|moment)|so|actually|like|you know|wait|okay so|and|but|because|maybe|i mean)\s*[.,]?\s*$/i;

/** True when the transcript ends in a hesitation/filler phrase. */
export function isThinkingPause(text) {
  if (!text) return false;
  return FILLER_TAIL.test(text.trim());
}

/**
 * Conservative sentence splitter. Breaks on .!? followed by whitespace or
 * end-of-string, keeping the terminator with the sentence so TTS gets natural
 * intonation. Common abbreviations (Dr., e.g., U.S.) and decimals are
 * protected from splitting.
 */
export function splitSentences(text) {
  if (!text || !text.trim()) return [];
  const protectedText = text
    .replace(/\b(Mr|Mrs|Ms|Dr|Sr|Jr|St|vs|e\.g|i\.e|etc|Inc|Co|Ltd|U\.S|U\.K)\./g, "$1¤")
    .replace(/(\d)\.(\d)/g, "$1¤$2");
  const parts = protectedText.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [text];
  return parts
    .map((s) => s.replace(/¤/g, ".").trim())
    .filter((s) => s.length > 0);
}
