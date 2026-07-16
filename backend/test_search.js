const dotenv = require('dotenv');
dotenv.config();

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Replicate fuzzy matching and state/city mapping from backend
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
    'Tarn Taran', 'Patti', 'Khemkaran', 'Dasuya', 'Mukerian',
  ],
  'Haryana': ['Ambala', 'Ambala City', 'Ambala Cantt', 'Shahbad', 'Kurukshetra', 'Karnal', 'Panipat', 'Sonipat'],
  'Jammu & Kashmir': ['Jammu', 'Kathua', 'Samba', 'Dori Brahmana', 'Vijaypur'],
  'Delhi': ['Delhi'],
  'Himachal Pradesh': ['Baddi', 'Damtal'],
  'Assam': ['Guwahati', 'Shillong', 'Jorhat', 'Dibrugarh', 'Tinsukia', 'Silchar', 'Karimganj', 'Agartala', 'Lalabazar', 'Aizawl', 'Hailakandi', 'Dharmanagar', 'Imphal', 'Dimapur', 'Nagaon', 'Lanka', 'Gola Ghat', 'Hojai'],
  'Bihar': ['Patna Jn', 'Patna City', 'Gaya', 'Siwan', 'Chapra', 'Muzaffarpur', 'Darbhanga', 'Sitamarhi', 'Samastipur', 'Raxaul', 'Purnea', 'Forbesganj', 'Katihar', 'Jogbani', 'Bhagalpur', 'Araria'],
  'Odisha': ['Cuttack', 'Bhubaneswar', 'Puri', 'Sambalpur', 'Rourkela', 'Berhampur', 'Jharsuguda'],
  'Jharkhand': ['Ranchi', 'Dhanbad', 'Jamshedpur', 'Tatanagar', 'Asansol', 'Chas', 'Giridih'],
};

function cleanStr(s) {
  return s.toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[m][n];
}

function isFuzzyMatch(str1, str2) {
  if (!str1 || !str2) return false;
  const s1 = cleanStr(str1), s2 = cleanStr(str2);
  if (s1 === s2 || s1.includes(s2) || s2.includes(s1)) return true;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen <= 3) return false;
  const dist = levenshtein(s1, s2);
  return dist <= (maxLen <= 5 ? 1 : maxLen <= 10 ? 2 : 3);
}

function resolveSearchQuery(destination) {
  const destTrimmed = destination.trim();
  const matchedStateName = Object.keys(STATE_CITY_MAP).find(s => isFuzzyMatch(s, destTrimmed));
  let matchedCityName = null;
  let resolvedStateName = null;
  if (!matchedStateName) {
    for (const [state, cities] of Object.entries(STATE_CITY_MAP)) {
      const found = cities.find(c => isFuzzyMatch(c, destTrimmed));
      if (found) {
        matchedCityName = found;
        resolvedStateName = state;
        break;
      }
    }
  }

  const resolvedDestination = matchedCityName || matchedStateName || destTrimmed;
  const isExactMatch = resolvedDestination.toLowerCase() === destTrimmed.toLowerCase();
  return { resolvedDestination, isExactMatch };
}

function runTests() {
  const cases = [
    'kolkata',   // exact match
    'kolktaa',   // fuzzy match (should resolve to Kolkata)
    'punjab',    // exact match
    'punjb',     // fuzzy match (should resolve to Punjab)
    'ludhiana',  // exact match
    'ludiana',   // fuzzy match (should resolve to Ludhiana)
  ];

  console.log('Testing resolvedDestination and isExactMatch output logic:');
  for (const c of cases) {
    const { resolvedDestination, isExactMatch } = resolveSearchQuery(c);
    console.log(`Input: "${c}" -> Resolved: "${resolvedDestination}", isExactMatch: ${isExactMatch}`);
  }
}

runTests();
