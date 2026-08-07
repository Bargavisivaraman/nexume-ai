/**
 * Popular USA locations for quick-pick filtering in the Jobs tab.
 *
 * `value` is what we send to the backend `state_filter` / `location` param —
 * the backend does an ilike pattern match against city/state, so we send the
 * city name (or "Remote" / "United States" for the wide-net cases).
 */

export const POPULAR_LOCATIONS = [
  // Remote bucket first
  { id: "remote",         label: "Remote (USA)",       value: "Remote",            emoji: "🌎", remote: true },

  // Top tech metros
  { id: "san-francisco",  label: "San Francisco",      value: "San Francisco, CA", emoji: "🌉" },
  { id: "new-york",       label: "New York City",      value: "New York, NY",      emoji: "🗽" },
  { id: "los-angeles",    label: "Los Angeles",        value: "Los Angeles, CA",   emoji: "🌴" },
  { id: "seattle",        label: "Seattle",            value: "Seattle, WA",       emoji: "🌲" },
  { id: "boston",         label: "Boston",             value: "Boston, MA",        emoji: "🎓" },
  { id: "austin",         label: "Austin",             value: "Austin, TX",        emoji: "🤠" },
  { id: "chicago",        label: "Chicago",            value: "Chicago, IL",       emoji: "🏙️" },
  { id: "denver",         label: "Denver",             value: "Denver, CO",        emoji: "⛰️" },
  { id: "atlanta",        label: "Atlanta",            value: "Atlanta, GA",       emoji: "🍑" },
  { id: "miami",          label: "Miami",              value: "Miami, FL",         emoji: "🌴" },
  { id: "san-diego",      label: "San Diego",          value: "San Diego, CA",     emoji: "🏖️" },
  { id: "dallas",         label: "Dallas",             value: "Dallas, TX",        emoji: "🤠" },
  { id: "houston",        label: "Houston",            value: "Houston, TX",       emoji: "🚀" },
  { id: "washington-dc",  label: "Washington, D.C.",   value: "Washington, DC",    emoji: "🏛️" },
  { id: "philadelphia",   label: "Philadelphia",       value: "Philadelphia, PA",  emoji: "🔔" },
  { id: "phoenix",        label: "Phoenix",            value: "Phoenix, AZ",       emoji: "🌵" },
  { id: "portland",       label: "Portland",           value: "Portland, OR",      emoji: "🌲" },
  { id: "minneapolis",    label: "Minneapolis",        value: "Minneapolis, MN",   emoji: "❄️" },
  { id: "nashville",      label: "Nashville",          value: "Nashville, TN",     emoji: "🎵" },
  { id: "raleigh",        label: "Raleigh",            value: "Raleigh, NC",       emoji: "🌳" },
  { id: "charlotte",      label: "Charlotte",          value: "Charlotte, NC",     emoji: "🏦" },
  { id: "salt-lake-city", label: "Salt Lake City",     value: "Salt Lake City, UT", emoji: "🏔️" },
  { id: "las-vegas",      label: "Las Vegas",          value: "Las Vegas, NV",     emoji: "🎰" },
  { id: "pittsburgh",     label: "Pittsburgh",         value: "Pittsburgh, PA",    emoji: "🌉" },
];

export const LOCATION_BY_ID = POPULAR_LOCATIONS.reduce((acc, l) => {
  acc[l.id] = l;
  return acc;
}, {});
