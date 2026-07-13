/**
 * Interview history — persists completed mock-interview scorecards in
 * localStorage so users can track improvement across sessions.
 *
 * Entry shape:
 *   {
 *     id:        number   (Date.now())
 *     date:      string   (locale date)
 *     mode:      string   (hr | behavioral | technical | case_study | stress)
 *     role:      string
 *     company:   string
 *     overall:   number   (0-100)
 *     scores:    { communication, technical_depth, confidence, structure }
 *     weaknesses: string[]
 *   }
 */

export const IV_HISTORY_KEY = "nexume_interview_history";
export const IV_HISTORY_MAX = 20;

export function loadInterviewHistory() {
  try {
    const list = JSON.parse(localStorage.getItem(IV_HISTORY_KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveInterviewToHistory(entry) {
  try {
    const list = [entry, ...loadInterviewHistory()].slice(0, IV_HISTORY_MAX);
    localStorage.setItem(IV_HISTORY_KEY, JSON.stringify(list));
    return list;
  } catch {
    return loadInterviewHistory();
  }
}

export function clearInterviewHistory() {
  try { localStorage.removeItem(IV_HISTORY_KEY); } catch {}
}

/**
 * Trend vs the PREVIOUS mock (entries are newest-first):
 *   +n / -n / 0, or null when there's no prior entry to compare with.
 */
export function trendForEntry(list, index) {
  if (!Array.isArray(list) || index < 0 || index >= list.length - 1) return null;
  const cur = list[index]?.overall;
  const prev = list[index + 1]?.overall;
  if (typeof cur !== "number" || typeof prev !== "number") return null;
  return cur - prev;
}

export function interviewScoreColor(v) {
  return v >= 80 ? "#22e597" : v >= 60 ? "#c084fc" : v >= 40 ? "#ffce47" : "#ff4d6d";
}

/** Plain-text export of a scorecard (for copy-to-clipboard). */
export function summaryToText(data, { role = "", company = "" } = {}) {
  const lines = [];
  lines.push(`Mock Interview Scorecard${role ? ` — ${role}` : ""}${company ? ` @ ${company}` : ""}`);
  lines.push(`Overall: ${data.overall_score}/100`);
  const axes = [
    ["Communication", data.communication_score],
    ["Technical depth", data.technical_depth_score],
    ["Confidence", data.confidence_score],
    ["Structure", data.structure_score],
  ].filter(([, v]) => typeof v === "number");
  for (const [label, v] of axes) lines.push(`${label}: ${v}/100`);
  if (data.strengths?.length) {
    lines.push("", "Strengths:");
    data.strengths.forEach(s => lines.push(`  + ${s}`));
  }
  if (data.weaknesses?.length) {
    lines.push("", "Weaknesses:");
    data.weaknesses.forEach(w => lines.push(`  - ${w}`));
  }
  if (data.improvement_plan?.length) {
    lines.push("", "Improvement plan:");
    data.improvement_plan.forEach((p, i) => lines.push(`  ${i + 1}. ${p}`));
  }
  return lines.join("\n");
}

/** Plain-text export of the conversation transcript. */
export function transcriptToText(history) {
  if (!Array.isArray(history)) return "";
  return history
    .filter(h => h?.content)
    .map(h => `${h.role === "ai" ? "Interviewer" : "You"}: ${h.content}`)
    .join("\n\n");
}
