/**
 * Interview mode and voice configuration for the voice mock interviewer.
 * Kept as data so the pacing tables stay in sync with the mode list.
 */

export const MODES = [
  { id: "hr",          label: "HR Screen",        emoji: "👋", desc: "Warm 20-min recruiter screen" },
  { id: "behavioral",  label: "Behavioral",       emoji: "💬", desc: "STAR-format storytelling" },
  { id: "technical",   label: "Technical",        emoji: "🛠️", desc: "Probing engineering interview" },
  { id: "case_study",  label: "Case Study",       emoji: "🧩", desc: "Consulting / business case" },
  { id: "stress",      label: "Stress Interview", emoji: "🔥", desc: "Aggressive challenging follow-ups" },
];

export const VOICES = [
  { id: "nova",     label: "Nova",     desc: "Warm female · OpenAI" },
  { id: "shimmer",  label: "Shimmer",  desc: "Bright female · OpenAI" },
  { id: "alloy",    label: "Alloy",    desc: "Neutral · OpenAI" },
  { id: "echo",     label: "Echo",     desc: "Smooth male · OpenAI" },
  { id: "onyx",     label: "Onyx",     desc: "Deep male · OpenAI" },
  { id: "fable",    label: "Fable",    desc: "Crisp British · OpenAI" },
  { id: "browser",  label: "Browser",  desc: "Free, robotic · no API call" },
];

// How long of a SILENCE counts as "the candidate finished speaking", per mode.
// Technical / case interviews give people more time to think.
export const SILENCE_BY_MODE = {
  hr:         2500,
  behavioral: 2500,
  technical:  4000,
  case_study: 4000,
  stress:     2000,
};

// TTS speed per mode — slightly snappier for HR/stress, normal for
// thinking-heavy modes.
export const TTS_SPEED_BY_MODE = {
  hr:         1.05,
  behavioral: 1.0,
  technical:  1.0,
  case_study: 1.0,
  stress:     1.1,
};
