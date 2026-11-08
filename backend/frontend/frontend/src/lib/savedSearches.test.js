import { describe, it, expect, beforeEach } from "vitest";
import {
  loadSavedSearches, saveSearch, removeSearch, touchSearch, countNewSince, describeSearch, searchKey,
} from "./savedSearches";
import { loadHidden, hideJob, unhideJob, clearHidden } from "./hiddenJobs";

beforeEach(() => localStorage.clear());

describe("saved searches", () => {
  const snap = { query: "frontend", location: "Austin, TX", filters: { remote: true, dateRange: "7d" } };

  it("saves, persists, and lists newest first", () => {
    let list = saveSearch([], snap, { resultCount: 12, now: 1000 });
    list = saveSearch(list, { query: "data", filters: {} }, { now: 2000 });
    expect(list.map(s => s.query)).toEqual(["data", "frontend"]);
    expect(loadSavedSearches().map(s => s.query)).toEqual(["data", "frontend"]);
    expect(list[1].lastCount).toBe(12);
  });

  it("de-duplicates the same search and keeps its id", () => {
    let list = saveSearch([], snap, { now: 1000 });
    const id = list[0].id;
    list = saveSearch(list, { ...snap, query: " frontend " }, { now: 5000 });
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(id);
    expect(list[0].lastSeenAt).toBe(5000);
  });

  it("removes and touches", () => {
    let list = saveSearch([], snap, { now: 1000 });
    list = touchSearch(list, list[0].id, { resultCount: 30, now: 9000 });
    expect(list[0].lastSeenAt).toBe(9000);
    expect(list[0].lastCount).toBe(30);
    list = removeSearch(list, list[0].id);
    expect(list).toEqual([]);
    expect(loadSavedSearches()).toEqual([]);
  });

  it("describes a search in plain words", () => {
    expect(describeSearch(snap)).toBe("frontend · Austin, TX · Remote · Past week");
    expect(describeSearch({ filters: {} })).toBe("All jobs");
    expect(describeSearch({ majorId: "cs", filters: { internship: true } }, { majorLabel: "Computer Science" })).toBe("Computer Science · Internship");
  });

  it("searchKey ignores whitespace but not filters", () => {
    expect(searchKey({ query: " x ", filters: {} })).toBe(searchKey({ query: "x", filters: {} }));
    expect(searchKey({ query: "x", filters: { remote: true } })).not.toBe(searchKey({ query: "x", filters: {} }));
  });

  it("survives corrupt storage", () => {
    localStorage.setItem("nexume_saved_searches", "{not json");
    expect(loadSavedSearches()).toEqual([]);
  });
});

describe("countNewSince", () => {
  it("counts jobs posted after the timestamp, ignoring undated", () => {
    const jobs = [
      { posted_at: "2026-08-10T00:00:00Z" },
      { posted_at: "2026-08-01T00:00:00Z" },
      { posted_at: null },
      { posted_at: "garbage" },
    ];
    expect(countNewSince(jobs, new Date("2026-08-05T00:00:00Z").getTime())).toBe(1);
    expect(countNewSince(jobs, 0)).toBe(0);
    expect(countNewSince([], 5)).toBe(0);
  });
});

describe("hidden jobs", () => {
  it("hides, unhides, persists, and clears", () => {
    let set = hideJob(loadHidden(), "j1");
    set = hideJob(set, "j2");
    expect([...loadHidden()]).toEqual(["j1", "j2"]);
    set = unhideJob(set, "j1");
    expect([...set]).toEqual(["j2"]);
    expect(hideJob(set, null)).toBe(set);
    expect(clearHidden().size).toBe(0);
    expect(loadHidden().size).toBe(0);
  });

  it("returns new Set instances so React state changes are detected", () => {
    const a = loadHidden();
    const b = hideJob(a, "x");
    expect(b).not.toBe(a);
    expect(a.has("x")).toBe(false);
  });
});
