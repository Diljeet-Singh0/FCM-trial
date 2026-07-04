const STATE_CITY_MAP = {
  'West Bengal': ['Kolkata', 'Siliguri', 'Darjeeling', 'Cooch Behar', 'Jaigaon', 'Dinhata'],
  'Maharashtra': ['Mumbai', 'Pune', 'Nagpur'],
  'Karnataka': ['Bangalore', 'Mysore', 'Hubli'],
  'Punjab': [
    'Amritsar', 'Ajnala', 'Batala', 'Gurdaspur', 'Pathankot', 'Hoshiarpur',
    'Jalandhar', 'Phagwara', 'Nakodar', 'Kapurthala', 'Sultanpur Lodhi',
    'Nawanshahr', 'Balachaur', 'Ludhiana', 'Doraha', 'Khanna', 'Samrala',
    'Mandi Gobindgarh', 'Sirhind', 'Rajpura', 'Patiala', 'Nabha',
    'Malerkotla', 'Ahmedgarh', 'Barnala', 'Sangrur', 'Sunam', 'Lehragaga',
    'Dhuri', 'Raikot', 'Jagraon', 'Moga', 'Kotkapura', 'Faridkot',
    'Ferozepur', 'Fazilka', 'Zira', 'Jalalabad', 'Muktsar', 'Abohar',
    'Tarn Taran', 'Patti', 'Khemkaran', 'Dasuya', 'Mukerian'
  ],
  'Haryana': ['Ambala', 'Ambala City', 'Ambala Cantt', 'Shahbad', 'Kurukshetra', 'Karnal', 'Panipat', 'Sonipat'],
  'Jammu & Kashmir': ['Jammu', 'Kathua', 'Samba', 'Dori Brahmana', 'Vijaypur'],
  'Delhi': ['Delhi'],
  'Himachal Pradesh': ['Baddi', 'Damtal'],
};

function levenshteinDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

function cleanForFuzzy(s) {
  return s.toLowerCase().trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

function isFuzzyMatch(str1, str2) {
  if (!str1 || !str2) return false;
  const s1 = cleanForFuzzy(str1);
  const s2 = cleanForFuzzy(str2);
  if (s1 === s2) return true;
  if (s1.includes(s2) || s2.includes(s1)) return true;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen <= 3) return false;
  const dist = levenshteinDistance(s1, s2);
  const maxAllowed = maxLen <= 5 ? 1 : maxLen <= 10 ? 2 : 3;
  return dist <= maxAllowed;
}

console.log('=== Fuzzy Match Tests ===');
console.log('1. "Jammu & Kashmir" vs "jammu and kasmir" ->', isFuzzyMatch("Jammu & Kashmir", "jammu and kasmir") ? 'PASS' : 'FAIL');
console.log('2. "Ludhiana" vs "ludhiyana" ->', isFuzzyMatch("Ludhiana", "ludhiyana") ? 'PASS' : 'FAIL');
console.log('3. "Ludhiana, Punjab" contains "ludhiana" ->', isFuzzyMatch("Ludhiana, Punjab", "ludhiana") ? 'PASS' : 'FAIL');
console.log('4. "Kolkata" vs "kolkatta" ->', isFuzzyMatch("Kolkata", "kolkatta") ? 'PASS' : 'FAIL');

// Test pickup city filtering logic
const c = { location: "Ludhiana, Punjab" };
const pickup_city = "ludhiyana";
const pickupLower = pickup_city.trim().toLowerCase();
const locWords = c.location.toLowerCase().split(/[\s,]+/).filter(Boolean);
const pickupWords = pickupLower.split(/[\s,]+/).filter(Boolean);
const pickupMatches = locWords.some(lw => pickupWords.some(pw => isFuzzyMatch(lw, pw)));
console.log('5. Pickup city check ("Ludhiana, Punjab" vs "ludhiyana") ->', pickupMatches ? 'PASS' : 'FAIL');
