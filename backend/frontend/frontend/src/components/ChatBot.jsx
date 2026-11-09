import { useState, useEffect, useRef, memo } from "react";

import { API } from "../lib/api";

/** Floating "Ask Nexus" career chatbot: FAB, drawer, and job cards. */
const ChatBot = memo(function ChatBot() {
  const [open, setOpen]       = useState(false);
  const [msgs, setMsgs]       = useState([{ role:"assistant", content:"Hey, I'm Nexus ✨ Your AI career co-pilot. Ask me anything. Resume tips, interview prep, salary negotiation, job search strategy." }]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef(null);
  const inputRef              = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, open]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 120); }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const newMsgs = [...msgs, { role:"user", content:text }];
    setMsgs(newMsgs);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/chat/`, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ messages: newMsgs.filter(m=>m.role!=="system") }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Error ${res.status}`);
      }
      const data = await res.json();
      setMsgs(prev => [...prev, { role:"assistant", content: data.reply || "No response received.", jobs: data.jobs || [] }]);
    } catch (e) {
      setMsgs(prev => [...prev, { role:"assistant", content:`Couldn't connect to Nexus. ${e.message || "Please try again."}` }]);
    } finally { setLoading(false); }
  };

  const onKey = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  return (
    <>
      <button className={`chat-fab ${open?"open":""}`} onClick={() => setOpen(v=>!v)} title="Ask Nexus">
        {open ? "✕" : <><span className="chat-fab-icon">✨</span><span className="chat-fab-label">Ask Nexus</span></>}
      </button>
      {open && (
        <div className="chat-drawer">
          <div className="chat-drawer-head">
            <div className="chat-head-info">
              <div className="chat-head-avatar">🤖</div>
              <div>
                <div className="chat-head-name">Nexus</div>
                <div className="chat-head-sub">Your career co-pilot</div>
              </div>
            </div>
            <button className="chat-close-btn" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="chat-messages">
            {msgs.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>
                {m.role === "assistant" && <div className="chat-msg-avatar">🤖</div>}
                <div>
                  <div className="chat-bubble">{m.content}</div>
                  {m.jobs && m.jobs.length > 0 && (
                    <div className="chat-job-cards">
                      {m.jobs.map((j, ji) => (
                        <a key={ji} className="chat-job-card" href={j.url || j.job_url || "#"} target="_blank" rel="noopener noreferrer">
                          <div className="chat-job-title">{j.title}</div>
                          <div className="chat-job-company">{j.company} · {j.location || j.state || "Remote"}</div>
                          {(j.employment_type || j.experience_level) && (
                            <div className="chat-job-meta">{j.employment_type || ""}{j.employment_type && j.experience_level ? " · " : ""}{j.experience_level || ""}</div>
                          )}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="chat-msg assistant">
                <div className="chat-msg-avatar">🤖</div>
                <div className="chat-bubble chat-typing"><span/><span/><span/></div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="chat-input-row">
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder="Ask anything about your job search…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              rows={1}
            />
            <button className="chat-send-btn" onClick={send} disabled={!input.trim()||loading}>
              {loading ? <span className="spinner"/> : "↑"}
            </button>
          </div>
        </div>
      )}
    </>
  );
});

export default ChatBot;
