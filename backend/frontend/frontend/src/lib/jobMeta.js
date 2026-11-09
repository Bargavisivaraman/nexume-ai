/**
 * Job metadata display helpers, shared by job cards and lists.
 */

const KNOWN_SOURCES = {
  "linkedin.com": "LinkedIn",
  "indeed.com": "Indeed",
  "glassdoor.com": "Glassdoor",
  "ziprecruiter.com": "ZipRecruiter",
  "monster.com": "Monster",
  "dice.com": "Dice",
  "greenhouse.io": "Greenhouse",
  "lever.co": "Lever",
  "workday.com": "Workday",
  "myworkdayjobs.com": "Workday",
  "icims.com": "iCIMS",
  "smartrecruiters.com": "SmartRecruiters",
  "careers.google.com": "Google",
  "jobs.apple.com": "Apple",
  "amazon.jobs": "Amazon",
  "microsoft.com": "Microsoft",
};

/** Human-readable source label for a job URL ("Job Board" when unparseable). */
export function getSource(url) {
  try {
    const host = new URL(url).hostname.replace("www.", "");
    return KNOWN_SOURCES[host] || host;
  } catch {
    return "Job Board";
  }
}

/** Pretty label for an ALL-CAPS employment type (null passes through). */
export function formatEmploymentType(t) {
  if (!t) return null;
  return (
    {
      FULLTIME: "Full-time",
      PARTTIME: "Part-time",
      CONTRACTOR: "Contract",
      INTERN: "Internship",
    }[t.toUpperCase()] || t
  );
}
