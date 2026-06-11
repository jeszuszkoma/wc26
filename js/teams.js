// Team metadata: flag emoji + football-data.org name aliases.
// Keys match openfootball team names exactly.
export const TEAMS = {
  'Algeria':              { flag: '🇩🇿', fd: ['Algeria'] },
  'Argentina':            { flag: '🇦🇷', fd: ['Argentina'] },
  'Australia':            { flag: '🇦🇺', fd: ['Australia'] },
  'Austria':              { flag: '🇦🇹', fd: ['Austria'] },
  'Belgium':              { flag: '🇧🇪', fd: ['Belgium'] },
  'Bosnia & Herzegovina': { flag: '🇧🇦', fd: ['Bosnia and Herzegovina', 'Bosnia-Herzegovina'] },
  'Brazil':               { flag: '🇧🇷', fd: ['Brazil'] },
  'Canada':               { flag: '🇨🇦', fd: ['Canada'] },
  'Cape Verde':           { flag: '🇨🇻', fd: ['Cape Verde', 'Cape Verde Islands', 'Cabo Verde'] },
  'Colombia':             { flag: '🇨🇴', fd: ['Colombia'] },
  'Croatia':              { flag: '🇭🇷', fd: ['Croatia'] },
  'Curaçao':              { flag: '🇨🇼', fd: ['Curaçao', 'Curacao'] },
  'Czech Republic':       { flag: '🇨🇿', fd: ['Czech Republic', 'Czechia'] },
  'DR Congo':             { flag: '🇨🇩', fd: ['DR Congo', 'Congo DR', 'Democratic Republic of the Congo'] },
  'Ecuador':              { flag: '🇪🇨', fd: ['Ecuador'] },
  'Egypt':                { flag: '🇪🇬', fd: ['Egypt'] },
  'England':              { flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', fd: ['England'] },
  'France':               { flag: '🇫🇷', fd: ['France'] },
  'Germany':              { flag: '🇩🇪', fd: ['Germany'] },
  'Ghana':                { flag: '🇬🇭', fd: ['Ghana'] },
  'Haiti':                { flag: '🇭🇹', fd: ['Haiti'] },
  'Iran':                 { flag: '🇮🇷', fd: ['Iran', 'IR Iran'] },
  'Iraq':                 { flag: '🇮🇶', fd: ['Iraq'] },
  'Ivory Coast':          { flag: '🇨🇮', fd: ['Ivory Coast', "Côte d'Ivoire", 'Cote d Ivoire'] },
  'Japan':                { flag: '🇯🇵', fd: ['Japan'] },
  'Jordan':               { flag: '🇯🇴', fd: ['Jordan'] },
  'Mexico':               { flag: '🇲🇽', fd: ['Mexico'] },
  'Morocco':              { flag: '🇲🇦', fd: ['Morocco'] },
  'Netherlands':          { flag: '🇳🇱', fd: ['Netherlands', 'Holland'] },
  'New Zealand':          { flag: '🇳🇿', fd: ['New Zealand'] },
  'Norway':               { flag: '🇳🇴', fd: ['Norway'] },
  'Panama':               { flag: '🇵🇦', fd: ['Panama'] },
  'Paraguay':             { flag: '🇵🇾', fd: ['Paraguay'] },
  'Portugal':             { flag: '🇵🇹', fd: ['Portugal'] },
  'Qatar':                { flag: '🇶🇦', fd: ['Qatar'] },
  'Saudi Arabia':         { flag: '🇸🇦', fd: ['Saudi Arabia'] },
  'Scotland':             { flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', fd: ['Scotland'] },
  'Senegal':              { flag: '🇸🇳', fd: ['Senegal'] },
  'South Africa':         { flag: '🇿🇦', fd: ['South Africa'] },
  'South Korea':          { flag: '🇰🇷', fd: ['South Korea', 'Korea Republic'] },
  'Spain':                { flag: '🇪🇸', fd: ['Spain'] },
  'Sweden':               { flag: '🇸🇪', fd: ['Sweden'] },
  'Switzerland':          { flag: '🇨🇭', fd: ['Switzerland'] },
  'Tunisia':              { flag: '🇹🇳', fd: ['Tunisia'] },
  'Turkey':               { flag: '🇹🇷', fd: ['Turkey', 'Türkiye', 'Turkiye'] },
  'USA':                  { flag: '🇺🇸', fd: ['USA', 'United States', 'United States of America'] },
  'Uruguay':              { flag: '🇺🇾', fd: ['Uruguay'] },
  'Uzbekistan':           { flag: '🇺🇿', fd: ['Uzbekistan'] },
};

export function flag(team) {
  if (TEAMS[team]) return TEAMS[team].flag;
  return '⚽'; // knockout placeholders like "1A", "2B", "W73"
}

// Map a football-data.org team name back to the openfootball name.
const FD_LOOKUP = {};
for (const [name, meta] of Object.entries(TEAMS)) {
  for (const alias of meta.fd) FD_LOOKUP[alias.toLowerCase()] = name;
}
export function fromFdName(fdName) {
  if (!fdName) return null;
  return FD_LOOKUP[fdName.toLowerCase()] ?? null;
}
