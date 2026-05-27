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

  // Refs
  const audioRef         = useRef(null);
  const recognitionRef   = useRef(null);
  const silenceTimerRef  = useRef(null);
  const lastFinalRef     = useRef("");
  const phaseRef         = useRef(phase);
  const historyRef       = useRef(history);
  const transcriptEndRef = useRef(null);

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

  // ── OpenAI TTS via backend proxy ─────────────────────────────────────────
  const speakOpenAI = useCallback(async (text, signal) => {
    try {
      const res = await fetch(`${API}/interview-tts/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice, speed: 1.0 }),
        signal,
      });
      if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      await new Promise((resolve, reject) => {
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
        audio.play().catch(reject);
      });
    } catch (e) {
      console.warn("[OpenAI TTS failed → browser fallback]", e);
      await speakBrowser(text);
    }
  }, [voice, speakBrowser]);

  const speak = useCallback(async (text) => {
    setStatusMsg("Interviewer speaking…");
    setPhase("speaking");
    if (voice === "browser") {
      await speakBrowser(text);
    } else {
      await speakOpenAI(text);
    }
  }, [voice, speakBrowser, speakOpenAI]);

  // ── Speech-to-text (browser native) ──────────────────────────────────────
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

      // Reset silence timer on any activity
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        // 1.6 s of silence after speech → treat as end of turn
        if (lastFinalRef.current.trim() || interimStr.trim()) {
          const utterance = (lastFinalRef.current + " " + interimStr).trim();
          if (utterance.length >= 2) {
            try { rec.stop(); } catch {}
            handleUserSpoke(utterance);
          }
        }
      }, 1600);
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
  }, []);

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
    const newHistory = [...historyRef.current, { role: "user", content: text }];
    setHistory(newHistory);
    setInterim("");

    setPhase("thinking");
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
  }, [mode, jd, resume, targetRole, targetCompany, speak, startListening, stopListening]);

  // ── Start / End ──────────────────────────────────────────────────────────
  const startInterview = useCallback(async () => {
    setError(null);
    setHistory([]);
    setSummary(null);
    setPhase("thinking");
    setStatusMsg("Preparing your interviewer…");

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

  const endInterview = useCallback(async (finalHistory) => {
    stopListening();
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
  }, [mode, targetRole, targetCompany, stopListening]);

  // ── Cleanup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopListening();
      try { audioRef.current?.pause(); } catch {}
      try { speechSynthesis.cancel(); } catch {}
    };
  }, [stopListening]);

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
        {history.map((h, i) => (
          <div key={i} className={`interview-sim-line ${h.role}`}>
            <span className="interview-sim-line-tag">{h.role === "ai" ? "Interviewer" : "You"}</span>
            <span className="interview-sim-line-text">{h.content}</span>
          </div>
        ))}
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
