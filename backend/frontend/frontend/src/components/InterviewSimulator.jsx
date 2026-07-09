import { useEffect, useRef, useState, useCallback } from "react";

const API = "https://landtherole-ai.onrender.com";

// ─────────────────────────────────────────────────────────────────────────────
// MODES + VOICES
// ─────────────────────────────────────────────────────────────────────────────

const MODES = [
  { id: "hr",          label: "HR Screen",        emoji: "👋", desc: "Warm 20-min recruiter screen" },
  { id: "behavioral",  label: "Behavioral",       emoji: "💬", desc: "STAR-format storytelling" },
  { id: "technical",   label: "Technical",        emoji: "🛠️", desc: "Probing engineering interview" },
  { id: "case_study",  label: "Case Study",       emoji: "🧩", desc: "Consulting / business case" },
  { id: "stress",      label: "Stress Interview", emoji: "🔥", desc: "Aggressive challenging follow-ups" },
];

const VOICES = [
  { id: "nova",     label: "Nova",     desc: "Warm female · OpenAI" },
  { id: "shimmer",  label: "Shimmer",  desc: "Bright female · OpenAI" },
  { id: "alloy",    label: "Alloy",    desc: "Neutral · OpenAI" },
  { id: "echo",     label: "Echo",     desc: "Smooth male · OpenAI" },
  { id: "onyx",     label: "Onyx",     desc: "Deep male · OpenAI" },
  { id: "fable",    label: "Fable",    desc: "Crisp British · OpenAI" },
  { id: "browser",  label: "Browser",  desc: "Free, robotic · no API call" },
];

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATIONAL PACING
// ─────────────────────────────────────────────────────────────────────────────

// How long of a SILENCE counts as "the candidate finished speaking", per mode.
// Technical / case interviews give people more time to think.
const SILENCE_BY_MODE = {
  hr:         2500,
  behavioral: 2500,
  technical:  4000,
  case_study: 4000,
  stress:     2000,
};

// TTS speed per mode — slightly snappier for HR/stress, normal for thinking-heavy modes.
const TTS_SPEED_BY_MODE = {
  hr:         1.05,
  behavioral: 1.0,
  technical:  1.0,
  case_study: 1.0,
  stress:     1.1,
};

// Filler / hesitation patterns at the TAIL of the running transcript.
// If the user just said one of these, they're thinking — extend silence threshold.
const FILLER_TAIL = /\b(um+|uh+|hmm+|er+|ah+|let me (think|see|try)|give me a (sec|second|moment)|hold on|one (sec|moment)|so|actually|like|you know|wait|okay so|and|but|because|maybe|i mean)\s*[.,]?\s*$/i;

function isThinkingPause(text) {
  if (!text) return false;
  return FILLER_TAIL.test(text.trim());
}

/**
 * Conservative sentence splitter. Breaks on .!? followed by whitespace or end-of-string.
 * Keeps the terminator with the sentence so TTS gets natural intonation.
 * Handles common abbreviations by NOT splitting on them (Dr., Mr., e.g., etc.).
 */
function splitSentences(text) {
  if (!text || !text.trim()) return [];
  // Protect common abbreviations
  const protectedText = text
    .replace(/\b(Mr|Mrs|Ms|Dr|Sr|Jr|St|vs|e\.g|i\.e|etc|Inc|Co|Ltd|U\.S|U\.K)\./g, "$1¤")
    .replace(/(\d)\.(\d)/g, "$1¤$2");
  const parts = protectedText.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [text];
  return parts
    .map(s => s.replace(/¤/g, ".").trim())
    .filter(s => s.length > 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// AVATAR — animated CSS orb that breathes/pulses/listens
// ─────────────────────────────────────────────────────────────────────────────

function InterviewerOrb({ state }) {
  // states: speaking | listening | thinking | idle
  return (
    <div className={`interview-orb interview-orb-${state}`} aria-hidden="true">
      <div className="interview-orb-core" />
      <div className="interview-orb-ring" />
      <div className="interview-orb-ring interview-orb-ring-2" />
      <div className="interview-orb-glow" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

export default function InterviewSimulator({ prefillTitle = "", prefillCompany = "" }) {
  // Setup
  const [mode, setMode]                 = useState("hr");
  const [voice, setVoice]               = useState("nova");
  const [jd, setJd]                     = useState("");
  const [resume, setResume]             = useState("");
  const [targetRole, setTargetRole]     = useState(prefillTitle);
  const [targetCompany, setTargetCompany] = useState(prefillCompany);

  // Conversation
  const [phase, setPhase]               = useState("setup"); // setup | speaking | listening | thinking | ended | summary
  const [history, setHistory]           = useState([]);
  const [interim, setInterim]           = useState("");
  const [statusMsg, setStatusMsg]       = useState("");
  const [error, setError]               = useState(null);
  const [summary, setSummary]           = useState(null);

  // Conversation state for streamed reveal
  const [aiSentences, setAiSentences]     = useState([]); // sentences of the CURRENT AI turn, revealed as audio plays
  const [activeSentence, setActiveSentence] = useState(-1); // index of sentence currently being spoken
  const [canInterrupt, setCanInterrupt]   = useState(false);

  // Refs
  const audioRef           = useRef(null);
  const recognitionRef     = useRef(null);
  const silenceTimerRef    = useRef(null);
  const lastFinalRef       = useRef("");
  const phaseRef           = useRef(phase);
  const historyRef         = useRef(history);
  // Accurate-STT capture (MediaRecorder → OpenAI transcription)
  const mediaStreamRef     = useRef(null);   // the getUserMedia stream (kept for the session)
  const mediaRecorderRef   = useRef(null);
  const audioChunksRef     = useRef([]);
  const transcriptEndRef   = useRef(null);
  // v2 — interrupt + sentence pipelining
  const interruptedRef     = useRef(false);
  const ttsControllersRef  = useRef([]);    // AbortController per pending TTS fetch
  const audioPlayingRef    = useRef(null);  // currently playing <Audio> instance

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history, interim]);

  // ── Browser TTS fallback ─────────────────────────────────────────────────
  const speakBrowser = useCallback((text) => new Promise((resolve) => {
    if (!("speechSynthesis" in window)) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    u.pitch = 1.0;
    u.onend = resolve;
    u.onerror = resolve;
    // Pick best available English voice
    const voices = speechSynthesis.getVoices();
    const preferred = voices.find(v => /samantha|google.*us english|microsoft jenny/i.test(v.name))
                   || voices.find(v => v.lang.startsWith("en-US"));
    if (preferred) u.voice = preferred;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }), []);

  // ── OpenAI TTS — single sentence fetch with cancellation ────────────────
  const fetchTTS = useCallback(async (text, controller) => {
    const ttsSpeed = TTS_SPEED_BY_MODE[mode] || 1.0;
    const res = await fetch(`${API}/interview-tts/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice, speed: ttsSpeed }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }, [voice, mode]);

  // ── Speak with sentence pipelining ───────────────────────────────────────
  // Splits the AI's response into sentences, kicks off all TTS fetches in
  // parallel, then plays them sequentially. First word reaches the user's ear
  // in ~0.5-0.8s (vs ~2.5s when waiting for the full response's audio).
  // Honors interrupt: if interruptedRef flips true mid-stream, stops cleanly.
  const speak = useCallback(async (text) => {
    interruptedRef.current = false;
    setStatusMsg("Interviewer speaking…");
    setPhase("speaking");
    setCanInterrupt(true);

    if (voice === "browser") {
      await speakBrowser(text);
      setCanInterrupt(false);
      return;
    }

    const sentences = splitSentences(text);
    if (sentences.length === 0) { setCanInterrupt(false); return; }

    setAiSentences(sentences);
    setActiveSentence(-1);

    // Kick off all fetches in parallel — browser caps concurrent connections
    // (~6 to one host), so very long responses self-throttle gracefully.
    ttsControllersRef.current = sentences.map(() => new AbortController());
    const audioPromises = sentences.map((s, i) =>
      fetchTTS(s, ttsControllersRef.current[i]).catch((e) => {
        if (e.name !== "AbortError") console.warn(`[TTS sentence ${i}]`, e);
        return null;
      })
    );

    // Play sequentially while fetches race ahead
    for (let i = 0; i < sentences.length; i++) {
      if (interruptedRef.current) break;
      setActiveSentence(i);
      const url = await audioPromises[i];
      if (interruptedRef.current) { if (url) URL.revokeObjectURL(url); continue; }
      if (!url) continue;
      await new Promise((resolve) => {
        const audio = new Audio(url);
        audioPlayingRef.current = audio;
        audioRef.current = audio;
        audio.onended  = () => { URL.revokeObjectURL(url); audioPlayingRef.current = null; resolve(); };
        audio.onerror  = ()   => { URL.revokeObjectURL(url); audioPlayingRef.current = null; resolve(); };
        audio.play().catch(() => resolve());
      });
    }

    // Cleanup any still-pending TTS URLs
    audioPromises.forEach(p => p.then(url => { if (url) URL.revokeObjectURL(url); }).catch(() => {}));
    setCanInterrupt(false);
    setActiveSentence(-1);
  }, [voice, speakBrowser, fetchTTS]);

  // ── Interrupt the AI mid-speech ──────────────────────────────────────────
  const interruptAI = useCallback(() => {
    interruptedRef.current = true;
    ttsControllersRef.current.forEach(c => { try { c.abort(); } catch {} });
    ttsControllersRef.current = [];
    if (audioPlayingRef.current) {
      try { audioPlayingRef.current.pause(); } catch {}
      audioPlayingRef.current = null;
    }
    try { speechSynthesis.cancel(); } catch {}
    setCanInterrupt(false);
  }, []);

  // ── Speech-to-text (browser native) ──────────────────────────────────────
  // ── Accurate STT: record audio in parallel, transcribe via OpenAI ──────────
  // Browser SpeechRecognition is used only for live captions + detecting WHEN
  // the candidate stops talking. The actual answer text comes from OpenAI
  // transcription of the recorded audio — far more accurate for technical
  // terms and accents. Falls back to the browser transcript on any failure.
  const startRecording = useCallback(() => {
    try {
      const stream = mediaStreamRef.current;
      if (!stream || typeof MediaRecorder === "undefined") return;
      // Pick a mime type the browser + OpenAI both accept
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]
        .find(m => MediaRecorder.isTypeSupported?.(m)) || "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data); };
      rec.start();
      mediaRecorderRef.current = rec;
    } catch (e) {
      console.warn("[MediaRecorder start]", e);
    }
  }, []);

  // Stop recording and resolve with a Blob of everything captured this turn.
  const stopRecording = useCallback(() => new Promise((resolve) => {
    const rec = mediaRecorderRef.current;
    if (!rec || rec.state === "inactive") { resolve(null); return; }
    rec.onstop = () => {
      const type = rec.mimeType || "audio/webm";
      const blob = audioChunksRef.current.length ? new Blob(audioChunksRef.current, { type }) : null;
      audioChunksRef.current = [];
      mediaRecorderRef.current = null;
      resolve(blob);
    };
    try { rec.stop(); } catch { resolve(null); }
  }), []);

  // Upload audio → accurate transcript. Returns null on any failure.
  const transcribeAudio = useCallback(async (blob) => {
    if (!blob || blob.size < 1200) return null; // too small to be real speech
    try {
      const ext = (blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm");
      const fd = new FormData();
      fd.append("audio", blob, `answer.${ext}`);
      const res = await fetch(`${API}/transcribe/`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`transcribe ${res.status}`);
      const data = await res.json();
      const text = (data.text || "").trim();
      return text.length >= 2 ? text : null;
    } catch (e) {
      console.warn("[transcribe] falling back to browser STT:", e);
      return null;
    }
  }, []);

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError("Voice recognition isn't supported in this browser. Use Chrome.");
      setPhase("setup");
      return;
    }
    setStatusMsg("Listening — start speaking…");
    setPhase("listening");
    setInterim("");
    lastFinalRef.current = "";
    startRecording(); // capture accurate audio alongside the browser recognizer

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (event) => {
      let interimStr = "";
      let finalStr = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalStr += t + " ";
        else                          interimStr += t;
      }
      if (finalStr) {
        lastFinalRef.current += finalStr;
      }
      setInterim(interimStr || lastFinalRef.current);

      // Mode-aware silence threshold. If the tail of what the user just said
      // looks like a filler ("um", "let me think", "so…"), extend the timer
      // significantly — they're still forming the thought.
      const utterance = (lastFinalRef.current + " " + interimStr).trim();
      const baseSilence = SILENCE_BY_MODE[mode] || 2500;
      const adjustedSilence = isThinkingPause(utterance) ? Math.round(baseSilence * 1.8) : baseSilence;

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        if (utterance.length >= 2) {
          try { rec.stop(); } catch {}
          handleUserSpoke(utterance);
        }
      }, adjustedSilence);
    };

    rec.onerror = (e) => {
      if (e.error === "not-allowed") {
        setError("Microphone permission denied. Allow mic access and reload.");
        setPhase("setup");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        console.warn("[SR error]", e.error);
      }
    };

    rec.onend = () => {
      // If we stopped without capturing anything (no-speech), give a nudge
      if (phaseRef.current === "listening" && !lastFinalRef.current.trim()) {
        setStatusMsg("Didn't hear anything — try again or type below");
      }
    };

    recognitionRef.current = rec;
    try { rec.start(); }
    catch (e) { console.warn("[SR start]", e); }
  }, [mode, startRecording]); // re-create when mode changes so silence threshold updates

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
  }, []);

  // ── Turn handler ─────────────────────────────────────────────────────────
  const handleUserSpoke = useCallback(async (text) => {
    stopListening();
    setPhase("thinking");

    // Get the accurate transcript from the recorded audio; fall back to the
    // browser recognizer's text if transcription fails or is empty.
    setStatusMsg("Transcribing…");
    let finalText = text;
    try {
      const blob = await stopRecording();
      const accurate = await transcribeAudio(blob);
      if (accurate) finalText = accurate;
    } catch (e) {
      console.warn("[handleUserSpoke] transcription error, using browser text", e);
    }

    const newHistory = [...historyRef.current, { role: "user", content: finalText }];
    setHistory(newHistory);
    setInterim("");
    setStatusMsg("Thinking…");

    try {
      const res = await fetch(`${API}/interview-turn/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          history: newHistory,
          jd,
          resume,
          target_role: targetRole,
          target_company: targetCompany,
          is_start: false,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Server error ${res.status}`);
      }
      const data = await res.json();
      const aiText = data.message || "Could you tell me more?";
      const withAi = [...newHistory, { role: "ai", content: aiText }];
      setHistory(withAi);
      await speak(aiText);

      if (data.should_end) {
        endInterview(withAi);
      } else {
        startListening();
      }
    } catch (e) {
      setError(e.message || "Conversation interrupted.");
      setPhase("ended");
    }
  }, [mode, jd, resume, targetRole, targetCompany, speak, startListening, stopListening, stopRecording, transcribeAudio]);

  // ── Start / End ──────────────────────────────────────────────────────────
  const startInterview = useCallback(async () => {
    setError(null);
    setHistory([]);
    setSummary(null);
    setPhase("thinking");
    setStatusMsg("Preparing your interviewer…");

    // Acquire one mic stream up front for MediaRecorder (accurate STT). The
    // browser SpeechRecognition grabs its own; this is a second, explicit tap
    // used only to record audio we send to OpenAI. Non-fatal if it fails —
    // we just fall back to browser-only transcripts.
    try {
      if (!mediaStreamRef.current && navigator.mediaDevices?.getUserMedia) {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch (e) {
      console.warn("[getUserMedia] accurate STT disabled, using browser only:", e);
    }

    try {
      const res = await fetch(`${API}/interview-turn/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          history: [],
          jd,
          resume,
          target_role: targetRole,
          target_company: targetCompany,
          is_start: true,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Server error ${res.status}`);
      }
      const data = await res.json();
      const aiText = data.message || "Hi! Let's get started — could you walk me through your background?";
      setHistory([{ role: "ai", content: aiText }]);
      await speak(aiText);
      startListening();
    } catch (e) {
      setError(e.message || "Couldn't start the interview. Try again.");
      setPhase("setup");
    }
  }, [mode, jd, resume, targetRole, targetCompany, speak, startListening]);

  // Release the mic stream + recorder (called when the interview ends/unmounts)
  const releaseMic = useCallback(() => {
    try { mediaRecorderRef.current?.state !== "inactive" && mediaRecorderRef.current?.stop(); } catch {}
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    try { mediaStreamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    mediaStreamRef.current = null;
  }, []);

  const endInterview = useCallback(async (finalHistory) => {
    stopListening();
    releaseMic();
    try { audioRef.current?.pause(); } catch {}
    setPhase("ended");
    setStatusMsg("Scoring your interview…");

    const h = finalHistory || historyRef.current;
    if (h.filter(x => x.role === "user").length === 0) {
      setPhase("setup");
      setError("No answers recorded — interview not scored.");
      return;
    }

    try {
      const res = await fetch(`${API}/interview-summary/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode, history: h,
          target_role: targetRole,
          target_company: targetCompany,
        }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setSummary(data);
      setPhase("summary");
    } catch (e) {
      setError(e.message || "Couldn't generate summary.");
      setPhase("ended");
    }
  }, [mode, targetRole, targetCompany, stopListening, releaseMic]);

  // ── Cleanup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopListening();
      releaseMic();
      try { audioRef.current?.pause(); } catch {}
      try { speechSynthesis.cancel(); } catch {}
    };
  }, [stopListening, releaseMic]);

  // Force voices to load (some browsers lazy-load)
  useEffect(() => {
    if ("speechSynthesis" in window) {
      speechSynthesis.getVoices();
      const onVoices = () => speechSynthesis.getVoices();
      speechSynthesis.addEventListener?.("voiceschanged", onVoices);
      return () => speechSynthesis.removeEventListener?.("voiceschanged", onVoices);
    }
  }, []);

  // ── RENDER ───────────────────────────────────────────────────────────────
  if (phase === "summary" && summary) {
    return <InterviewSummary data={summary} onRestart={() => {
      setSummary(null); setHistory([]); setPhase("setup");
    }} />;
  }

  if (phase === "setup") {
    return (
      <div className="interview-sim-setup">
        {prefillTitle && (
          <div className="prefill-banner">
            Mocking: <strong>{prefillTitle}</strong>{prefillCompany ? ` at ${prefillCompany}` : ""}
          </div>
        )}

        <label className="field-label">Interview Mode</label>
        <div className="sim-mode-grid">
          {MODES.map(m => (
            <button
              key={m.id}
              className={`sim-mode-card ${mode === m.id ? "active" : ""}`}
              onClick={() => setMode(m.id)}
            >
              <span className="sim-mode-emoji">{m.emoji}</span>
              <span className="sim-mode-label">{m.label}</span>
              <span className="sim-mode-desc">{m.desc}</span>
            </button>
          ))}
        </div>

        <label className="field-label">Interviewer Voice</label>
        <div className="sim-voice-row">
          {VOICES.map(v => (
            <button
              key={v.id}
              className={`sim-voice-pill ${voice === v.id ? "active" : ""}`}
              onClick={() => setVoice(v.id)}
              title={v.desc}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
          <div>
            <label className="field-label">Target Role</label>
            <input
              className="sm-input"
              placeholder="e.g. Senior Frontend Engineer"
              value={targetRole}
              onChange={e => setTargetRole(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Target Company (optional)</label>
            <input
              className="sm-input"
              placeholder="e.g. Stripe"
              value={targetCompany}
              onChange={e => setTargetCompany(e.target.value)}
            />
          </div>
        </div>

        <label className="field-label">Job Description (optional)</label>
        <textarea
          className="interview-textarea"
          rows={5}
          placeholder="Paste the JD for sharper, role-specific questions…"
          value={jd}
          onChange={e => setJd(e.target.value)}
        />

        <label className="field-label">Your Resume (optional)</label>
        <textarea
          className="interview-textarea"
          rows={4}
          placeholder="Paste your resume so the interviewer probes your actual experience…"
          value={resume}
          onChange={e => setResume(e.target.value)}
        />

        {error && <p className="error-msg" style={{ marginTop: 12 }}>{error}</p>}

        <button className="analyze-btn" style={{ marginTop: 22 }} onClick={startInterview}>
          🎙️ Start Live Mock Interview
        </button>
        <p className="sim-disclaimer">
          Chrome recommended · Microphone permission required · Conversation stays on your device + our servers (not stored)
        </p>
      </div>
    );
  }

  // Active interview view
  return (
    <div className="interview-sim-stage">
      <InterviewerOrb state={phase} />

      <div className="interview-sim-status">
        <span className="interview-sim-mode-tag">{MODES.find(m => m.id === mode)?.emoji} {MODES.find(m => m.id === mode)?.label}</span>
        <span className="interview-sim-status-text">{statusMsg}</span>
      </div>

      <div className="interview-sim-transcript">
        {history.map((h, i) => {
          // For the CURRENT AI turn that's actively being spoken, render
          // sentence-by-sentence with the active sentence highlighted.
          const isCurrentAi = h.role === "ai" && i === history.length - 1 && phase === "speaking" && aiSentences.length > 0;
          if (isCurrentAi) {
            return (
              <div key={i} className="interview-sim-line ai">
                <span className="interview-sim-line-tag">Interviewer · speaking</span>
                <span className="interview-sim-line-text">
                  {aiSentences.map((s, si) => (
                    <span
                      key={si}
                      className={
                        si === activeSentence ? "sim-sentence-active" :
                        si <  activeSentence ? "sim-sentence-spoken" :
                                              "sim-sentence-pending"
                      }
                    >
                      {s}{si < aiSentences.length - 1 ? " " : ""}
                    </span>
                  ))}
                </span>
              </div>
            );
          }
          return (
            <div key={i} className={`interview-sim-line ${h.role}`}>
              <span className="interview-sim-line-tag">{h.role === "ai" ? "Interviewer" : "You"}</span>
              <span className="interview-sim-line-text">{h.content}</span>
            </div>
          );
        })}
        {interim && phase === "listening" && (
          <div className="interview-sim-line user interview-sim-interim">
            <span className="interview-sim-line-tag">You · live</span>
            <span className="interview-sim-line-text">{interim}</span>
          </div>
        )}
        <div ref={transcriptEndRef} />
      </div>

      {error && <p className="error-msg" style={{ marginTop: 12 }}>{error}</p>}

      <div className="interview-sim-controls">
        {phase === "listening" && (
          <button
            className="sim-control-btn sim-control-skip"
            onClick={() => {
              const utt = (lastFinalRef.current + " " + interim).trim();
              if (utt.length >= 2) handleUserSpoke(utt);
            }}
          >
            ✓ I'm done answering
          </button>
        )}
        {phase === "speaking" && canInterrupt && (
          <button
            className="sim-control-btn sim-control-interrupt"
            onClick={interruptAI}
            title="Stop the interviewer and start your answer"
          >
            ✋ Interrupt
          </button>
        )}
        <button className="sim-control-btn sim-control-end" onClick={() => endInterview()}>
          ⏹ End Interview
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY CARD
// ─────────────────────────────────────────────────────────────────────────────

function InterviewSummary({ data, onRestart }) {
  const scores = [
    { label: "Overall",       value: data.overall_score },
    { label: "Communication", value: data.communication_score },
    { label: "Tech Depth",    value: data.technical_depth_score },
    { label: "Confidence",    value: data.confidence_score },
    { label: "Structure",     value: data.structure_score },
  ].filter(s => typeof s.value === "number");

  const color = (v) => v >= 80 ? "#22e597" : v >= 60 ? "#c084fc" : v >= 40 ? "#ffce47" : "#ff4d6d";

  return (
    <div className="interview-sim-summary">
      <div className="interview-sim-summary-header">
        <h2>Your Interview Scorecard</h2>
        <button className="reset-btn" onClick={onRestart}>← New Mock</button>
      </div>

      <div className="sim-score-grid">
        {scores.map(s => (
          <div key={s.label} className="sim-score-card">
            <div className="sim-score-label">{s.label}</div>
            <div className="sim-score-value" style={{ color: color(s.value) }}>
              {s.value}<span className="sim-score-unit">/100</span>
            </div>
            <div className="sim-score-bar">
              <div className="sim-score-bar-fill" style={{ width: `${s.value}%`, background: color(s.value) }} />
            </div>
          </div>
        ))}
      </div>

      {data.strengths?.length > 0 && (
        <div className="sim-summary-section">
          <h3 className="sim-summary-heading">Strengths</h3>
          <ul className="sim-summary-list sim-strengths">
            {data.strengths.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}

      {data.weaknesses?.length > 0 && (
        <div className="sim-summary-section">
          <h3 className="sim-summary-heading">Weaknesses</h3>
          <ul className="sim-summary-list sim-weaknesses">
            {data.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {data.key_moments?.length > 0 && (
        <div className="sim-summary-section">
          <h3 className="sim-summary-heading">Key Moments to Rewrite</h3>
          {data.key_moments.map((m, i) => (
            <div key={i} className="sim-key-moment">
              <div className="sim-key-question"><strong>Q:</strong> {m.question}</div>
              <div className="sim-key-before"><span className="tag tag-before">You said</span><p>{m.what_you_said}</p></div>
              <div className="sim-key-after"><span className="tag tag-after">Better answer</span><p>{m.what_to_say_instead}</p></div>
            </div>
          ))}
        </div>
      )}

      {data.improvement_plan?.length > 0 && (
        <div className="sim-summary-section">
          <h3 className="sim-summary-heading">Your Improvement Plan</h3>
          <ol className="sim-summary-list sim-improvement">
            {data.improvement_plan.map((p, i) => <li key={i}>{p}</li>)}
          </ol>
        </div>
      )}
    </div>
  );
}
