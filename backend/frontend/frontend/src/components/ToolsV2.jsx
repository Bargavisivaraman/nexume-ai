import { useState, useEffect } from "react";
import { API } from "../lib/api";

/**
 * AI Tools v2 — JD Decoder, STAR Story Builder, Elevator Pitch,
 * Offer Negotiator, Reply Composer.
 *
 * Lazy-loaded from ToolsPage so the main bundle stays lean. Every panel
 * shares the same fetch/loading/error shape via useTool(); resume text is
 * remembered across tools so users don't paste it five times.
 */

// ── shared plumbing ──────────────────────────────────────────────────────────

function useTool(path) {
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);

  const run = async (body) => {
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch(`${API}${path}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
      setResult(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  return { loading, result, error, setError, run, reset: () => setResult(null) };
}

const RESUME_KEY = "nexume_resume_text";
function useStickyResume() {
  const [text, setText] = useState(() => {
    try { return localStorage.getItem(RESUME_KEY) || ""; } catch { return ""; }
  });
  useEffect(() => {
    try { if (text) localStorage.setItem(RESUME_KEY, text); } catch { /* private mode */ }
  }, [text]);
  return [text, setText];
}

function useCopy() {
  const [copied, setCopied] = useState(null);
  const copy = (text, id = "x") => {
    navigator.clipboard?.writeText(text);
    setCopied(id); setTimeout(() => setCopied(null), 1800);
  };
  return [copied, copy];
}

const CopyBox = ({ text, subject, id, copied, copy, style }) => (
  <div className="email-box" style={style}>
    <button className="tool-copy-btn" onClick={() => copy(subject ? `Subject: ${subject}\n\n${text}` : text, id)}>
      {copied === id ? "✓" : "Copy"}
    </button>
    {subject && <div className="email-subject">Subject: {subject}</div>}
    {text}
  </div>
);

const Pills = ({ items, tone = "purple" }) =>
  items?.length > 0 ? (
    <div className="tag-list" style={{ marginBottom: 16 }}>
      {items.map((s, i) => <span key={i} className={`tag-pill tag-${tone}`}>{s}</span>)}
    </div>
  ) : null;

const List = ({ items, color = "#bb86fc", render }) =>
  items?.length > 0 ? (
    <div className="skill-list" style={{ marginBottom: 14 }}>
      {items.map((it, i) => (
        <div key={i} className="skill-item">
          <span className="skill-dot" style={{ background: color }} />
          <div>{render ? render(it) : it}</div>
        </div>
      ))}
    </div>
  ) : null;

const Section = ({ title, children }) => (children ? <><div className="tool-result-title">{title}</div>{children}</> : null);

const Picker = ({ options, value, onChange }) => (
  <div className="tone-picker">
    {options.map(o => {
      const id = typeof o === "string" ? o : o.id;
      const label = typeof o === "string" ? o : o.label;
      return (
        <button key={id} className={`tone-btn ${value === id ? "active" : ""}`} onClick={() => onChange(id)}>{label}</button>
      );
    })}
  </div>
);

const RunButton = ({ loading, onClick, busy, label }) => (
  <button className="analyze-btn" onClick={onClick} disabled={loading} style={{ marginTop: 20 }}>
    {loading ? <><span className="spinner" /> {busy}</> : label}
  </button>
);

const Err = ({ error }) => (error ? <p className="error-msg" style={{ marginTop: 10 }}>{error}</p> : null);

const Field = ({ label, children, style }) => (
  <div style={style}>
    <label className="field-label">{label}</label>
    {children}
  </div>
);

const SIGNAL_TONE = {
  "Explicitly sponsors": "green", "Explicitly does not sponsor": "red", "Ambiguous": "blue", "Not mentioned": "blue",
  "Range listed": "green", "Vague": "blue",
};

// ── 1. JD Decoder ────────────────────────────────────────────────────────────

export function JDDecoderTool() {
  const [jd, setJd] = useState("");
  const [resume, setResume] = useStickyResume();
  const tool = useTool("/decode-jd/");
  const [copied, copy] = useCopy();
  const r = tool.result;

  const run = () => {
    if (jd.trim().length < 80) return tool.setError("Paste the full job description (80+ characters).");
    tool.run({ job_description: jd, resume_text: resume });
  };

  return (
    <div className="tool-card">
      <div className="tool-card-title">🧩 JD Decoder</div>
      <div className="tool-card-sub">Paste a job description and see what they actually want: real must-haves, hidden expectations, red flags, sponsorship and pay signals, and the questions to ask.</div>
      <Field label="Job Description *">
        <textarea className="interview-textarea" rows={8} placeholder="Paste the full job posting…" value={jd} onChange={e => setJd(e.target.value)} />
      </Field>
      <Field label="Your Resume (optional, adds fit notes)" style={{ marginTop: 14 }}>
        <textarea className="interview-textarea" rows={4} placeholder="Paste your resume text to get fit/gap notes…" value={resume} onChange={e => setResume(e.target.value)} />
      </Field>
      <Err error={tool.error} />
      <RunButton loading={tool.loading} onClick={run} busy="Decoding…" label="🧩 Decode This JD" />

      {r && (
        <div className="tool-result">
          <div style={{ fontSize: 15, lineHeight: 1.7, color: "var(--text)", marginBottom: 14 }}>{r.role_summary}</div>
          <div className="tag-list" style={{ marginBottom: 18 }}>
            {r.seniority && <span className="tag-pill tag-purple">Level: {r.seniority}</span>}
            {r.sponsorship_signal && <span className={`tag-pill tag-${SIGNAL_TONE[r.sponsorship_signal] || "blue"}`} title={r.sponsorship_note || ""}>Visa: {r.sponsorship_signal}</span>}
            {r.comp_transparency && <span className={`tag-pill tag-${SIGNAL_TONE[r.comp_transparency] || "red"}`}>Pay: {r.comp_transparency}</span>}
          </div>
          {r.sponsorship_note && <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: -10, marginBottom: 16 }}>{r.sponsorship_note}</div>}
          <Section title="Must-haves (screener will reject on these)"><Pills items={r.must_haves} tone="red" /></Section>
          <Section title="Nice-to-haves (negotiable)"><Pills items={r.nice_to_haves} tone="blue" /></Section>
          <Section title="Hidden expectations"><List items={r.hidden_expectations} color="#ffd60a" /></Section>
          {r.red_flags?.length > 0 && (
            <Section title="Red flags 🚩">
              <List items={r.red_flags} color="#ff453a" render={f => <><strong style={{ color: "var(--text)" }}>{f.flag}</strong><br /><span style={{ fontSize: 12.5 }}>{f.why}</span></>} />
            </Section>
          )}
          <Section title="Green flags ✓"><List items={r.green_flags} color="#30d158" /></Section>
          {r.keywords_for_resume?.length > 0 && (
            <Section title="Keywords to mirror on your resume">
              <Pills items={r.keywords_for_resume} tone="purple" />
              <button className="tone-btn" style={{ marginTop: -6, marginBottom: 14 }} onClick={() => copy(r.keywords_for_resume.join(", "), "kw")}>{copied === "kw" ? "✓ Copied" : "Copy all keywords"}</button>
            </Section>
          )}
          <Section title="Questions to ask them"><List items={r.questions_to_ask} color="#60a5fa" /></Section>
          {r.fit_notes?.length > 0 && <Section title="How you fit"><List items={r.fit_notes} color="#bb86fc" /></Section>}
        </div>
      )}
    </div>
  );
}

// ── 2. STAR Story Builder ────────────────────────────────────────────────────

export function StarStoryTool() {
  const [experience, setExperience] = useState("");
  const [competency, setCompetency] = useState("");
  const [role, setRole] = useState("");
  const [version, setVersion] = useState("90s");
  const tool = useTool("/build-star-story/");
  const [copied, copy] = useCopy();
  const r = tool.result;

  const run = () => {
    if (experience.trim().length < 60) return tool.setError("Describe what happened in a bit more detail (60+ characters).");
    tool.run({ experience, competency, target_role: role });
  };

  const full = r ? `${r.title}\n\nSituation: ${r.situation}\nTask: ${r.task}\nAction: ${r.action}\nResult: ${r.result}` : "";

  return (
    <div className="tool-card">
      <div className="tool-card-title">⭐ STAR Story Builder</div>
      <div className="tool-card-sub">Turn a messy memory of something you did into a tight behavioural-interview story, with a 30-second and a 90-second version and the follow-ups interviewers will probe.</div>
      <Field label="What happened? (rough notes are fine) *">
        <textarea className="interview-textarea" rows={7} placeholder="e.g. Our deploys took 40 minutes and broke every week. I pushed to rebuild the CI pipeline, got buy-in from two other teams, added caching and parallel jobs…" value={experience} onChange={e => setExperience(e.target.value)} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
        <Field label="Competency to showcase"><input className="modal-input" style={{ marginTop: 6 }} placeholder="e.g. Ownership, Conflict, Leadership" value={competency} onChange={e => setCompetency(e.target.value)} /></Field>
        <Field label="Target role"><input className="modal-input" style={{ marginTop: 6 }} placeholder="e.g. Backend Engineer" value={role} onChange={e => setRole(e.target.value)} /></Field>
      </div>
      <Err error={tool.error} />
      <RunButton loading={tool.loading} onClick={run} busy="Structuring…" label="⭐ Build My Story" />

      {r && (
        <div className="tool-result">
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em", marginBottom: 16 }}>{r.title}</div>
          <div className="star-grid">
            {[["S", "Situation", r.situation], ["T", "Task", r.task], ["A", "Action", r.action], ["R", "Result", r.result]].map(([k, label, text]) => (
              <div key={k} className="star-block">
                <div className="star-letter">{k}</div>
                <div><div className="star-label">{label}</div><div className="star-text">{text}</div></div>
              </div>
            ))}
          </div>
          <button className="tone-btn" style={{ marginTop: 12 }} onClick={() => copy(full, "full")}>{copied === "full" ? "✓ Copied" : "Copy full STAR"}</button>

          <Section title="Spoken versions">
            <Picker options={[{ id: "30s", label: "30 seconds" }, { id: "90s", label: "90 seconds" }]} value={version} onChange={setVersion} />
            <CopyBox style={{ marginTop: 12, marginBottom: 16 }} id={version} copied={copied} copy={copy} text={version === "30s" ? r.version_30s : r.version_90s} />
          </Section>
          <Section title="Competencies this shows"><Pills items={r.competencies_shown} tone="green" /></Section>
          <Section title="Use it to answer"><List items={r.answers_questions} color="#60a5fa" /></Section>
          {r.likely_follow_ups?.length > 0 && (
            <Section title="Likely follow-ups">
              <List items={r.likely_follow_ups} color="#ffd60a" render={f => <><strong style={{ color: "var(--text)" }}>{f.question}</strong><br /><span style={{ fontSize: 12.5 }}>{f.how_to_answer}</span></>} />
            </Section>
          )}
          <Section title="Fill these in to make it stronger"><List items={r.missing_details} color="#ff9f0a" /></Section>
          <Section title="Honest critique"><List items={r.weak_spots} color="#ff453a" /></Section>
        </div>
      )}
    </div>
  );
}

// ── 3. Elevator Pitch ────────────────────────────────────────────────────────

const PITCH_CONTEXTS = [
  { id: "interview", label: "Interview" }, { id: "networking", label: "Networking" },
  { id: "recruiter_call", label: "Recruiter call" }, { id: "career_fair", label: "Career fair" },
];

export function PitchTool() {
  const [resume, setResume] = useStickyResume();
  const [role, setRole] = useState("");
  const [context, setContext] = useState("interview");
  const [length, setLength] = useState("60s");
  const tool = useTool("/generate-pitch/");
  const [copied, copy] = useCopy();
  const r = tool.result;

  const run = () => {
    if (resume.trim().length < 100) return tool.setError("Paste more of your resume (100+ characters).");
    if (!role.trim()) return tool.setError("Enter the role you're pitching for.");
    tool.run({ resume_text: resume, target_role: role, context });
  };
  const pitchText = r ? { "30s": r.pitch_30s, "60s": r.pitch_60s, "90s": r.pitch_90s }[length] : "";

  return (
    <div className="tool-card">
      <div className="tool-card-title">🎤 Elevator Pitch</div>
      <div className="tool-card-sub">"Tell me about yourself" is the one question you know is coming. Get 30, 60 and 90-second versions that sound like you talking, not your resume read aloud.</div>
      <Field label="Target Role *"><input className="modal-input" style={{ marginTop: 6, marginBottom: 14 }} placeholder="e.g. Data Scientist" value={role} onChange={e => setRole(e.target.value)} /></Field>
      <Field label="Where will you use it?" style={{ marginBottom: 14 }}><div style={{ marginTop: 8 }}><Picker options={PITCH_CONTEXTS} value={context} onChange={setContext} /></div></Field>
      <Field label="Your Resume *"><textarea className="interview-textarea" rows={6} placeholder="Paste your resume text…" value={resume} onChange={e => setResume(e.target.value)} /></Field>
      <Err error={tool.error} />
      <RunButton loading={tool.loading} onClick={run} busy="Writing…" label="🎤 Write My Pitch" />

      {r && (
        <div className="tool-result">
          {r.hook && <div className="pitch-hook">“{r.hook}”</div>}
          <Section title="Your pitch">
            <Picker options={[{ id: "30s", label: "30 sec" }, { id: "60s", label: "60 sec" }, { id: "90s", label: "90 sec" }]} value={length} onChange={setLength} />
            <CopyBox style={{ marginTop: 12 }} id={length} copied={copied} copy={copy} text={pitchText} />
            {r.closing_line && <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 10, marginBottom: 16 }}><strong style={{ color: "var(--v-200)" }}>Close with:</strong> {r.closing_line}</div>}
          </Section>
          {r.headline_options?.length > 0 && (
            <Section title="LinkedIn headline options">
              <List items={r.headline_options} color="#bb86fc" render={h => (
                <span style={{ display: "flex", justifyContent: "space-between", gap: 12, width: "100%" }}>
                  <span>{h}</span>
                  <button className="tone-btn" style={{ padding: "2px 10px", fontSize: 11 }} onClick={() => copy(h, h)}>{copied === h ? "✓" : "Copy"}</button>
                </span>
              )} />
            </Section>
          )}
          <Section title="Proof points it leans on"><Pills items={r.proof_points} tone="green" /></Section>
          <Section title="Don't say"><List items={r.avoid} color="#ff453a" /></Section>
          <Section title="Delivery tips"><List items={r.delivery_tips} color="#ffd60a" /></Section>
        </div>
      )}
    </div>
  );
}

// ── 4. Offer Negotiator ──────────────────────────────────────────────────────

const money = (n) => (n || n === 0) ? `$${Math.round(n).toLocaleString()}` : "—";

export function NegotiatorTool() {
  const [f, setF] = useState({ role: "", company: "", location: "United States", base_salary: "", bonus: "", signing_bonus: "", equity: "", years_experience: "", competing_offer: "", priorities: "", notes: "" });
  const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }));
  const tool = useTool("/negotiate-offer/");
  const [copied, copy] = useCopy();
  const r = tool.result;

  const run = () => {
    if (!f.role.trim()) return tool.setError("Enter the role.");
    const base = Number(String(f.base_salary).replace(/[^0-9.]/g, ""));
    if (!base || base <= 0) return tool.setError("Enter the base salary they offered.");
    const num = (v) => { const n = Number(String(v).replace(/[^0-9.]/g, "")); return n > 0 ? n : null; };
    tool.run({
      role: f.role, company: f.company, location: f.location, base_salary: base,
      bonus: num(f.bonus), signing_bonus: num(f.signing_bonus), equity: f.equity,
      years_experience: num(f.years_experience), competing_offer: f.competing_offer,
      priorities: f.priorities, notes: f.notes,
    });
  };

  const verdictColor = { "Strong": "#30d158", "Fair": "#60a5fa", "Below market": "#ffd60a", "Lowball": "#ff453a" }[r?.verdict] || "var(--text)";
  const inp = (k, ph, type = "text") => <input className="modal-input" style={{ marginTop: 6 }} placeholder={ph} value={f[k]} onChange={set(k)} inputMode={type === "num" ? "decimal" : undefined} />;

  return (
    <div className="tool-card">
      <div className="tool-card-title">🤝 Offer Negotiator</div>
      <div className="tool-card-sub">Got an offer? Find out how it sits against the market, what to ask for, and get the exact counter-offer email and phone script.</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Role *">{inp("role", "e.g. Software Engineer II")}</Field>
        <Field label="Company">{inp("company", "e.g. Stripe")}</Field>
        <Field label="Location">{inp("location", "e.g. Seattle, WA or Remote")}</Field>
        <Field label="Years of experience">{inp("years_experience", "e.g. 3", "num")}</Field>
        <Field label="Base salary offered *">{inp("base_salary", "e.g. 135000", "num")}</Field>
        <Field label="Annual bonus">{inp("bonus", "e.g. 13500", "num")}</Field>
        <Field label="Signing bonus">{inp("signing_bonus", "e.g. 10000", "num")}</Field>
        <Field label="Equity">{inp("equity", "e.g. 400 RSUs over 4 yrs, or 0.05%")}</Field>
        <Field label="Competing offer (if any)" style={{ gridColumn: "1/-1" }}>{inp("competing_offer", "e.g. $150k base at a Series B startup, or none")}</Field>
        <Field label="What matters most to you" style={{ gridColumn: "1/-1" }}>{inp("priorities", "e.g. base pay, remote work, start date, title")}</Field>
      </div>
      <Field label="Anything else (visa timeline, deadline they gave you, how the call went)" style={{ marginTop: 14 }}>
        <textarea className="interview-textarea" rows={3} placeholder="Optional context…" value={f.notes} onChange={set("notes")} />
      </Field>
      <Err error={tool.error} />
      <RunButton loading={tool.loading} onClick={run} busy="Assessing…" label="🤝 Plan My Negotiation" />

      {r && (
        <div className="tool-result">
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", marginBottom: 8 }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: verdictColor, letterSpacing: "-0.03em" }}>{r.verdict}</div>
            {r.leverage_score != null && <span className="tag-pill tag-purple">Leverage {r.leverage_score}/10</span>}
          </div>
          <div style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.7, marginBottom: 6 }}>{r.verdict_reason}</div>
          {r.leverage_reason && <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 16 }}>{r.leverage_reason}</div>}
          {r.market_range && (
            <Section title="Market range for this role">
              <div className="salary-range">
                <div className="salary-card"><div className="salary-label">Low</div><div className="salary-value">{money(r.market_range.low)}</div></div>
                <div className="salary-card" style={{ border: "1px solid rgba(123,47,247,0.4)" }}><div className="salary-label">Mid</div><div className="salary-value" style={{ color: "#bb86fc" }}>{money(r.market_range.mid)}</div></div>
                <div className="salary-card"><div className="salary-label">High</div><div className="salary-value">{money(r.market_range.high)}</div></div>
              </div>
            </Section>
          )}
          {r.recommended_ask && (
            <Section title="What to ask for">
              <div className="salary-range">
                <div className="salary-card" style={{ border: "1px solid rgba(34,229,151,0.4)" }}><div className="salary-label">Counter base</div><div className="salary-value" style={{ color: "#4be5b3" }}>{money(r.recommended_ask.base)}</div></div>
                {r.recommended_ask.signing_bonus ? <div className="salary-card"><div className="salary-label">Signing</div><div className="salary-value">{money(r.recommended_ask.signing_bonus)}</div></div> : null}
                {r.walk_away_number ? <div className="salary-card"><div className="salary-label">Walk away below</div><div className="salary-value" style={{ color: "#ff8aa0" }}>{money(r.walk_away_number)}</div></div> : null}
              </div>
              {r.recommended_ask.other && <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 14 }}><strong style={{ color: "var(--v-200)" }}>Also ask:</strong> {r.recommended_ask.other}</div>}
            </Section>
          )}
          {r.counter_email && <Section title="Counter-offer email"><CopyBox id="email" copied={copied} copy={copy} text={r.counter_email} style={{ marginBottom: 16 }} /></Section>}
          {r.phone_script?.length > 0 && (
            <Section title="Phone script">
              <List items={r.phone_script} color="#60a5fa" render={(line) => line} />
            </Section>
          )}
          <Section title="If base is firm, ask for"><List items={r.if_they_say_no} color="#ffd60a" /></Section>
          <Section title="Mistakes to avoid"><List items={r.mistakes_to_avoid} color="#ff453a" /></Section>
          <Section title="Clarify before you sign"><List items={r.questions_to_ask} color="#bb86fc" /></Section>
        </div>
      )}
    </div>
  );
}

// ── 5. Reply Composer ────────────────────────────────────────────────────────

const INTENTS = [
  { id: "accept_interview", label: "Accept interview" }, { id: "reschedule", label: "Reschedule" },
  { id: "ask_details", label: "Ask for details" }, { id: "thank_you", label: "Post-interview thank you" },
  { id: "follow_up", label: "Follow up on silence" }, { id: "decline", label: "Decline (keep door open)" },
  { id: "accept_offer", label: "Accept offer" }, { id: "decline_offer", label: "Decline offer" },
];

export function ReplyTool() {
  const [msg, setMsg] = useState("");
  const [intent, setIntent] = useState("accept_interview");
  const [name, setName] = useState("");
  const [context, setContext] = useState("");
  const [tone, setTone] = useState("warm");
  const tool = useTool("/compose-reply/");
  const [copied, copy] = useCopy();
  const r = tool.result;

  const run = () => {
    if (msg.trim().length < 20) return tool.setError("Paste the message you're replying to.");
    tool.run({ their_message: msg, intent, your_name: name, context, tone });
  };

  return (
    <div className="tool-card">
      <div className="tool-card-title">💬 Reply Composer</div>
      <div className="tool-card-sub">Recruiter emailed you? Paste it, pick what you want to happen, and get a reply that's ready to send, plus a short version for LinkedIn.</div>
      <Field label="Their message *">
        <textarea className="interview-textarea" rows={6} placeholder="Paste the recruiter's or hiring manager's message…" value={msg} onChange={e => setMsg(e.target.value)} />
      </Field>
      <Field label="What do you want to do?" style={{ marginTop: 14 }}><div style={{ marginTop: 8 }}><Picker options={INTENTS} value={intent} onChange={setIntent} /></div></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginTop: 14 }}>
        <Field label="Your name"><input className="modal-input" style={{ marginTop: 6 }} placeholder="e.g. Bargavi" value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="Details to include"><input className="modal-input" style={{ marginTop: 6 }} placeholder="e.g. free Tue/Wed after 2pm; need the comp range; interviewed with Sam on Monday" value={context} onChange={e => setContext(e.target.value)} /></Field>
      </div>
      <Field label="Tone" style={{ marginTop: 14 }}><div style={{ marginTop: 8 }}><Picker options={[{ id: "warm", label: "Warm" }, { id: "formal", label: "Formal" }, { id: "brief", label: "Brief" }]} value={tone} onChange={setTone} /></div></Field>
      <Err error={tool.error} />
      <RunButton loading={tool.loading} onClick={run} busy="Writing…" label="💬 Write My Reply" />

      {r && (
        <div className="tool-result">
          <Section title="Reply"><CopyBox id="reply" copied={copied} copy={copy} subject={r.subject} text={r.reply} style={{ marginBottom: 16 }} /></Section>
          {r.alt_shorter && <Section title="Short version (LinkedIn / chat)"><CopyBox id="short" copied={copied} copy={copy} text={r.alt_shorter} style={{ marginBottom: 16 }} /></Section>}
          <Section title="What this accomplishes"><Pills items={r.key_points_hit} tone="green" /></Section>
          <Section title="Before you send"><List items={r.before_sending} color="#ffd60a" /></Section>
          {r.reply_timing && <div style={{ fontSize: 13, color: "var(--text-dim)" }}>⏱ {r.reply_timing}</div>}
        </div>
      )}
    </div>
  );
}

export default { JDDecoderTool, StarStoryTool, PitchTool, NegotiatorTool, ReplyTool };
