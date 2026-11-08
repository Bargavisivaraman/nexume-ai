import { describe, it, expect } from "vitest";
import {
  sortJobs, salaryMid, salaryInsights, sponsorshipSignal, similarJobs, skillChips, formatK,
} from "./jobInsights";

const job = (over = {}) => ({
  job_id: over.job_id || Math.random().toString(36).slice(2),
  title: "Software Engineer", company: "Acme", industry: "Technology",
  experience_level: "Mid Level", is_remote: false, tech_stack: [], posted_at: null,
  salary_min: null, salary_max: null, description: "", ...over,
});

describe("salaryMid", () => {
  it("averages a range and tolerates one-sided ranges", () => {
    expect(salaryMid(job({ salary_min: 100000, salary_max: 140000 }))).toBe(120000);
    expect(salaryMid(job({ salary_min: 100000 }))).toBe(100000);
    expect(salaryMid(job({ salary_max: 90000 }))).toBe(90000);
    expect(salaryMid(job())).toBeNull();
  });
});

describe("sortJobs", () => {
  const a = job({ job_id: "a", posted_at: "2026-08-01T00:00:00Z", salary_min: 100000, salary_max: 120000 });
  const b = job({ job_id: "b", posted_at: "2026-08-10T00:00:00Z", salary_min: 150000, salary_max: 170000 });
  const c = job({ job_id: "c", posted_at: null });

  it("newest puts most recent first and undated last", () => {
    expect(sortJobs([a, c, b], "newest").map(j => j.job_id)).toEqual(["b", "a", "c"]);
  });

  it("salary sorts by midpoint, unsalaried last", () => {
    expect(sortJobs([a, c, b], "salary").map(j => j.job_id)).toEqual(["b", "a", "c"]);
  });

  it("match uses the score function and falls back to date", () => {
    const score = { a: 40, b: 90, c: 90 };
    expect(sortJobs([a, b, c], "match", j => score[j.job_id]).map(j => j.job_id)).toEqual(["b", "c", "a"]);
  });

  it("unknown mode returns a copy in original order", () => {
    const out = sortJobs([b, a], "nope");
    expect(out.map(j => j.job_id)).toEqual(["b", "a"]);
    expect(out).not.toBe([b, a]);
  });

  it("is stable for ties", () => {
    const x = job({ job_id: "x" }), y = job({ job_id: "y" }), z = job({ job_id: "z" });
    expect(sortJobs([x, y, z], "match").map(j => j.job_id)).toEqual(["x", "y", "z"]);
  });
});

describe("salaryInsights", () => {
  it("returns null on empty input", () => {
    expect(salaryInsights([])).toBeNull();
    expect(salaryInsights(null)).toBeNull();
  });

  it("computes median, coverage, remote share, and top skills", () => {
    const jobs = [
      job({ salary_min: 100000, salary_max: 120000, is_remote: true, tech_stack: ["Python", "AWS"], company: "A" }),
      job({ salary_min: 140000, salary_max: 160000, tech_stack: ["Python", "React"], company: "B" }),
      job({ tech_stack: ["Python"], company: "A" }),
      job({ company: "C" }),
    ];
    const s = salaryInsights(jobs);
    expect(s.total).toBe(4);
    expect(s.medianSalary).toBe(130000);
    expect(s.pctWithSalary).toBe(50);
    expect(s.remotePct).toBe(25);
    expect(s.companies).toBe(3);
    expect(s.topSkills[0]).toEqual({ name: "Python", count: 3 });
  });
});

describe("sponsorshipSignal", () => {
  it("is none when nothing is mentioned", () => {
    expect(sponsorshipSignal(job({ description: "We build great software." }))).toBe("none");
  });
  it("detects explicit refusals", () => {
    expect(sponsorshipSignal(job({ description: "We are unable to sponsor visas at this time." }))).toBe("no");
    expect(sponsorshipSignal(job({ description: "Must be authorized to work in the US without sponsorship now or in the future." }))).toBe("no");
    expect(sponsorshipSignal(job({ description: "This role does not offer visa sponsorship." }))).toBe("no");
  });
  it("flags neutral or positive mentions", () => {
    expect(sponsorshipSignal(job({ description: "Visa sponsorship available for the right candidate." }))).toBe("mentions");
    expect(sponsorshipSignal(job({ description: "We support H-1B transfers." }))).toBe("mentions");
  });
});

describe("similarJobs", () => {
  const target = job({ job_id: "t", title: "Senior Backend Engineer", tech_stack: ["Python", "Postgres"], industry: "Technology", company: "Acme" });
  const pool = [
    target,
    job({ job_id: "1", title: "Backend Engineer", tech_stack: ["Python"], industry: "Technology", company: "Other" }),
    job({ job_id: "2", title: "Marketing Coordinator", tech_stack: [], industry: "Marketing", company: "Other" }),
    job({ job_id: "3", title: "Staff Backend Engineer", tech_stack: ["Python", "Postgres"], industry: "Technology", company: "Acme" }),
  ];
  it("excludes itself and ranks by overlap", () => {
    const out = similarJobs(target, pool, 3).map(j => j.job_id);
    expect(out[0]).toBe("3");
    expect(out).toContain("1");
    expect(out).not.toContain("t");
    expect(out).not.toContain("2");
  });
  it("handles empty input", () => {
    expect(similarJobs(null, pool)).toEqual([]);
    expect(similarJobs(target, [])).toEqual([]);
  });
});

describe("skillChips", () => {
  it("puts resume-matched skills first and counts overflow", () => {
    const j = job({ tech_stack: ["Go", "Rust", "Python", "AWS", "React", "Kafka", "Redis"] });
    const { chips, extra } = skillChips(j, new Set(["python", "redis"]), 4);
    expect(chips.map(c => c.name)).toEqual(["Python", "Redis", "Go", "Rust"]);
    expect(chips[0].matched).toBe(true);
    expect(chips[2].matched).toBe(false);
    expect(extra).toBe(3);
  });
  it("works without a resume and without a stack", () => {
    expect(skillChips(job({ tech_stack: ["Go"] }), null).chips[0]).toEqual({ name: "Go", matched: false });
    expect(skillChips(job(), null)).toEqual({ chips: [], extra: 0 });
  });
});

describe("formatK", () => {
  it("formats thousands", () => {
    expect(formatK(145000)).toBe("$145k");
    expect(formatK(null)).toBe("—");
  });
});
