import { describe, it, expect, beforeEach } from "vitest";
import {
  TRACKER_KEY,
  loadTracker,
  isJobTracked,
  addJobToTracker,
  trackerToCsv,
} from "./trackerStore";

const job = (over = {}) => ({
  title: "Software Engineer",
  company: "Stripe",
  url: "https://stripe.com/jobs/1",
  location: "SF",
  ...over,
});

beforeEach(() => localStorage.clear());

describe("loadTracker", () => {
  it("[] when empty or corrupt", () => {
    expect(loadTracker()).toEqual([]);
    localStorage.setItem(TRACKER_KEY, "{bad");
    expect(loadTracker()).toEqual([]);
    localStorage.setItem(TRACKER_KEY, JSON.stringify("nope"));
    expect(loadTracker()).toEqual([]);
  });
});

describe("addJobToTracker / isJobTracked", () => {
  it("adds with applied status and location note", () => {
    const list = addJobToTracker(job());
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe("applied");
    expect(list[0].notes).toContain("SF");
    expect(loadTracker()).toHaveLength(1); // persisted
  });

  it("is idempotent on same url", () => {
    addJobToTracker(job());
    const list = addJobToTracker(job({ title: "Different Title" }));
    expect(list).toHaveLength(1);
  });

  it("dedupes on title+company when url missing", () => {
    addJobToTracker(job({ url: "" }));
    const list = addJobToTracker(job({ url: "" }));
    expect(list).toHaveLength(1);
  });

  it("different job appends on top", () => {
    addJobToTracker(job());
    const list = addJobToTracker(job({ title: "PM", url: "https://x.com/2" }));
    expect(list).toHaveLength(2);
    expect(list[0].title).toBe("PM");
  });

  it("isJobTracked matches case-insensitively", () => {
    addJobToTracker(job());
    expect(isJobTracked(job({ title: "SOFTWARE ENGINEER", url: "" }))).toBe(true);
    expect(isJobTracked(job({ title: "Designer", url: "" }))).toBe(false);
  });
});

describe("trackerToCsv", () => {
  it("emits header + quoted rows, escaping quotes", () => {
    addJobToTracker(job({ title: 'Eng, "Core"' }));
    const csv = trackerToCsv();
    const lines = csv.split("\n");
    expect(lines[0]).toContain('"Company"');
    expect(lines[1]).toContain('"Eng, ""Core"""');
    expect(lines[1]).toContain('"Stripe"');
  });

  it("header only when empty", () => {
    expect(trackerToCsv([]).split("\n")).toHaveLength(1);
  });
});
