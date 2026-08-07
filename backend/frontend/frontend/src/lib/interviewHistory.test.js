import { describe, it, expect, beforeEach } from "vitest";
import {
  IV_HISTORY_KEY,
  IV_HISTORY_MAX,
  loadInterviewHistory,
  saveInterviewToHistory,
  clearInterviewHistory,
  trendForEntry,
  interviewScoreColor,
  summaryToText,
  transcriptToText,
} from "./interviewHistory";

const entry = (overall, extra = {}) => ({
  id: Math.random(), date: "Jul 10", mode: "hr", role: "SWE",
  company: "", overall, scores: {}, weaknesses: [], ...extra,
});

beforeEach(() => localStorage.clear());

describe("load/save/clear", () => {
  it("returns [] when nothing stored", () => {
    expect(loadInterviewHistory()).toEqual([]);
  });

  it("returns [] on corrupt JSON", () => {
    localStorage.setItem(IV_HISTORY_KEY, "{not json");
    expect(loadInterviewHistory()).toEqual([]);
  });

  it("returns [] when stored value is not an array", () => {
    localStorage.setItem(IV_HISTORY_KEY, JSON.stringify({ nope: true }));
    expect(loadInterviewHistory()).toEqual([]);
  });

  it("prepends newest entry", () => {
    saveInterviewToHistory(entry(50));
    const list = saveInterviewToHistory(entry(70));
    expect(list[0].overall).toBe(70);
    expect(list[1].overall).toBe(50);
  });

  it("caps at IV_HISTORY_MAX entries", () => {
    for (let i = 0; i < IV_HISTORY_MAX + 5; i++) saveInterviewToHistory(entry(i));
    expect(loadInterviewHistory()).toHaveLength(IV_HISTORY_MAX);
  });

  it("clears", () => {
    saveInterviewToHistory(entry(60));
    clearInterviewHistory();
    expect(loadInterviewHistory()).toEqual([]);
  });
});

describe("trendForEntry (list is newest-first)", () => {
  const list = [entry(80), entry(65), entry(70)];

  it("newest vs previous → +15", () => {
    expect(trendForEntry(list, 0)).toBe(15);
  });

  it("middle vs oldest → -5", () => {
    expect(trendForEntry(list, 1)).toBe(-5);
  });

  it("oldest has nothing to compare → null", () => {
    expect(trendForEntry(list, 2)).toBeNull();
  });

  it("null on bad input", () => {
    expect(trendForEntry(null, 0)).toBeNull();
    expect(trendForEntry([entry(50)], 0)).toBeNull();
    expect(trendForEntry([{ overall: "x" }, entry(50)], 0)).toBeNull();
  });
});

describe("interviewScoreColor", () => {
  it("tiers correctly", () => {
    expect(interviewScoreColor(85)).toBe("#22e597");
    expect(interviewScoreColor(65)).toBe("#c084fc");
    expect(interviewScoreColor(45)).toBe("#ffce47");
    expect(interviewScoreColor(20)).toBe("#ff4d6d");
  });
});

describe("summaryToText", () => {
  const data = {
    overall_score: 72,
    communication_score: 80,
    technical_depth_score: 60,
    strengths: ["Clear examples"],
    weaknesses: ["No metrics"],
    improvement_plan: ["Add numbers to results"],
  };

  it("includes role/company header and all sections", () => {
    const t = summaryToText(data, { role: "SWE", company: "Stripe" });
    expect(t).toContain("SWE");
    expect(t).toContain("Stripe");
    expect(t).toContain("Overall: 72/100");
    expect(t).toContain("+ Clear examples");
    expect(t).toContain("- No metrics");
    expect(t).toContain("1. Add numbers to results");
  });

  it("skips missing axes and works without role/company", () => {
    const t = summaryToText({ overall_score: 50 });
    expect(t).toContain("Overall: 50/100");
    expect(t).not.toContain("Confidence");
  });
});

describe("transcriptToText", () => {
  it("labels speakers and joins turns", () => {
    const t = transcriptToText([
      { role: "ai", content: "Tell me about yourself." },
      { role: "user", content: "I build things." },
    ]);
    expect(t).toBe("Interviewer: Tell me about yourself.\n\nYou: I build things.");
  });

  it("handles bad input", () => {
    expect(transcriptToText(null)).toBe("");
    expect(transcriptToText([{ role: "ai" }, null])).toBe("");
  });
});
