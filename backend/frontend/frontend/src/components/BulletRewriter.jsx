import { useState } from "react";
import { API } from "../lib/api";

/** Weak-bullet list with one-click AI rewrite, before/after view, and copy. */
export default function BulletRewriter({ bullets, jobContext }) {
  const [selected, setSelected] = useState(null);
  const [rewriting, setRewriting] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const rewrite = async (bullet) => {
    setSelected(bullet); setRewriting(true); setResult(null); setCopied(false);
    try {
      const res = await fetch(`${API}/rewrite-bullet/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bullet, job_context: jobContext || "" }),
      });
      setResult(await res.json());
    } catch {
      setResult({ rewritten: "Failed to rewrite. Try again.", explanation: "" });
    } finally { setRewriting(false); }
  };

  const copy = () => {
    navigator.clipboard.writeText(result.rewritten);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bullet-rewriter reveal">
      <div className="rewriter-intro">
        <span className="rewriter-badge">AI Rewriter</span>
        <p>Click any weak bullet below to instantly improve it with strong action verbs, metrics, and ATS keywords.</p>
      </div>
      <div className="bullet-list">
        {bullets.map((b, i) => (
          <button key={i} className={`bullet-item ${selected === b ? "selected" : ""}`} onClick={() => rewrite(b)}>
            <span className="bullet-weak-tag">weak</span>
            <span className="bullet-text">{b}</span>
            <span className="bullet-arrow">→</span>
          </button>
        ))}
      </div>
      {(rewriting || result) && (
        <div className="rewrite-result">
          {rewriting ? (
            <div className="rewrite-loading"><span className="spinner" /> Rewriting with AI…</div>
          ) : result && (
            <>
              <div className="rewrite-original"><span className="tag tag-before">Before</span><p>{selected}</p></div>
              <div className="rewrite-arrow-down">↓</div>
              <div className="rewrite-improved">
                <span className="tag tag-after">After</span>
                <p>{result.rewritten}</p>
                <button className="copy-btn" onClick={copy}>{copied ? "✓ Copied!" : "Copy"}</button>
              </div>
              {result.explanation && <p className="rewrite-explanation">{result.explanation}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
