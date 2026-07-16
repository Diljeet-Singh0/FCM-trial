import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  Image,
  ActivityIndicator,
  TextInput,
  FlatList,
  Alert,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchDestinations, searchTransportCompanies, fetchUserProfile, fetchTransportCompanies, addCustomTransportCompany } from '../api';

type Company = {
  id: string;
  name: string;
  location: string;
  ratePerKg: number;
  rateDisplay?: string;
  rating: number;
  totalRatings: number;
  routes: string[];
  depotAddress: string;
  description: string;
  established: string;
  contactPhone: string;
  routes_v2?: any[];
  images?: string[];
  matchType?: 'city' | 'state';
  priceMin?: number;
  priceMax?: number;
  deliveryDaysMin?: number;
  deliveryDaysMax?: number;
  deliveryTime?: string;
  delivery_time?: string;
  searchedDestination?: string;
};

type Destination = {
  name: string;
  type: 'city' | 'state';
  state: string;
};

type Props = {
  onBack: () => void;
  onSelectCompany: (company: Company) => void;
  ownerId: string;
};

const extractCityFromAddress = (address: string): string | null => {
  if (!address) return null;
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  
  const statesAndUTs = new Set([
    'punjab', 'haryana', 'delhi', 'rajasthan', 'uttar pradesh', 'up', 'u.p.',
    'madhya pradesh', 'mp', 'm.p.', 'gujarat', 'maharashtra', 'karnataka',
    'tamil nadu', 'tn', 't.n.', 'andhra pradesh', 'ap', 'a.p.', 'telangana',
    'kerala', 'west bengal', 'wb', 'w.b.', 'bihar', 'jharkhand', 'odisha',
    'orissa', 'chhattisgarh', 'assam', 'himachal pradesh', 'hp', 'h.p.',
    'jammu', 'kashmir', 'jammu & kashmir', 'j&k', 'uttarakhand', 'goa', 'india'
  ]);

  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    const normalized = part.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    if (/^\d{6}$/.test(normalized) || /^\d+$/.test(normalized)) {
      continue;
    }
    if (statesAndUTs.has(normalized)) {
      continue;
    }
    if (part) {
      return part;
    }
  }
  return parts[parts.length - 2] || parts[0] || null;
};

const RECENT_SEARCHES_KEY = '@gozo_recent_searches';

// Fallback destinations when API is unavailable (e.g. backend not deployed yet)
const FALLBACK_DESTINATIONS: Destination[] = (() => {
  const map: Record<string, string[]> = {
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
  const result: Destination[] = [];
  for (const [state, cities] of Object.entries(map)) {
    result.push({ name: state, type: 'state', state });
    for (const city of cities) {
      result.push({ name: city, type: 'city', state });
    }
  }
  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
})();

// ─── Client-side route data for fallback matching ───
const CLIENT_ROUTES_V2: Record<string, { state: string; cities: string[] }[]> = {
  'tc-001': [{ state: 'West Bengal', cities: ['Kolkata'] }],
  'tc-002': [
    { state: 'Maharashtra', cities: ['Mumbai', 'Pune', 'Nagpur'] },
    { state: 'Karnataka', cities: ['Bangalore', 'Mysore', 'Hubli'] },
  ],
  'tc-003': [
    { state: 'Punjab', cities: ['Amritsar', 'Ajnala', 'Batala', 'Gurdaspur', 'Pathankot', 'Hoshiarpur', 'Jalandhar', 'Phagwara', 'Nakodar', 'Kapurthala', 'Sultanpur Lodhi', 'Nawanshahr', 'Balachaur', 'Ludhiana', 'Doraha', 'Khanna', 'Samrala', 'Mandi Gobindgarh', 'Sirhind', 'Rajpura', 'Patiala', 'Nabha', 'Malerkotla', 'Ahmedgarh', 'Barnala', 'Sangrur', 'Sunam', 'Lehragaga', 'Dhuri', 'Raikot', 'Jagraon', 'Moga', 'Kotkapura', 'Faridkot', 'Ferozepur', 'Fazilka', 'Zira', 'Jalalabad', 'Muktsar', 'Abohar', 'Tarn Taran', 'Patti', 'Khemkaran', 'Dasuya', 'Mukerian'] },
    { state: 'Haryana', cities: ['Ambala', 'Ambala City', 'Ambala Cantt', 'Shahbad', 'Kurukshetra', 'Karnal', 'Panipat', 'Sonipat'] },
    { state: 'Jammu & Kashmir', cities: ['Jammu', 'Kathua', 'Samba', 'Dori Brahmana', 'Vijaypur'] },
    { state: 'Delhi', cities: ['Delhi'] },
    { state: 'Himachal Pradesh', cities: ['Baddi', 'Damtal'] },
  ],
  'tc-004': [
    { state: 'Assam', cities: ['Guwahati', 'Shillong', 'Jorhat', 'Dibrugarh', 'Tinsukia', 'Silchar', 'Karimganj', 'Agartala', 'Lalabazar', 'Aizawl', 'Hailakandi', 'Dharmanagar', 'Imphal', 'Dimapur', 'Nagaon', 'Lanka', 'Gola Ghat', 'Hojai'] },
    { state: 'Bihar', cities: ['Patna Jn', 'Patna City', 'Gaya', 'Siwan', 'Chapra', 'Muzaffarpur', 'Darbhanga', 'Sitamarhi', 'Samastipur', 'Raxaul', 'Purnea', 'Forbesganj', 'Katihar', 'Jogbani', 'Bhagalpur', 'Araria'] },
    { state: 'West Bengal', cities: ['Kolkata', 'Siliguri', 'Darjeeling', 'Cooch Behar', 'Jaigaon', 'Dinhata'] },
    { state: 'Odisha', cities: ['Cuttack', 'Bhubaneswar', 'Puri', 'Sambalpur', 'Rourkela', 'Berhampur', 'Jharsuguda'] },
    { state: 'Jharkhand', cities: ['Ranchi', 'Dhanbad', 'Jamshedpur', 'Tatanagar', 'Asansol', 'Chas', 'Giridih'] },
  ],
};

// ─── Simple fuzzy matching for client-side fallback ───
function cleanStr(s: string): string {
  return s.toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[m][n];
}

function fuzzyMatch(str1: string, str2: string): boolean {
  if (!str1 || !str2) return false;
  const s1 = cleanStr(str1), s2 = cleanStr(str2);
  if (s1 === s2 || s1.includes(s2) || s2.includes(s1)) return true;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen <= 3) return false;
  const dist = levenshtein(s1, s2);
  return dist <= (maxLen <= 5 ? 1 : maxLen <= 10 ? 2 : 3);
}

function filterCompaniesClientSide(companies: Company[], destination: string, pickupCity: string): Company[] {
  return companies.filter((c) => {
    // Filter by pickup city (company location must match)
    if (pickupCity) {
      const locWords = c.location.toLowerCase().split(/[\s,]+/).filter(Boolean);
      const pickupWords = pickupCity.toLowerCase().split(/[\s,]+/).filter(Boolean);
      const pickupMatch = locWords.some(lw => pickupWords.some(pw => fuzzyMatch(lw, pw)));
      if (!pickupMatch) return false;
    }

    // Check if company's routes cover the destination
    const routes = CLIENT_ROUTES_V2[c.id] || [];
    for (const route of routes) {
      if (fuzzyMatch(route.state, destination)) return true;
      if (route.cities.some(city => fuzzyMatch(city, destination))) return true;
    }
    return false;
  });
}

const CompanyCardItem = ({ company, onSelectCompany }: { company: Company, onSelectCompany: (company: Company) => void }) => {
  // Use first image if present, else fallback
  const thumbnail = (company.images && company.images.length > 0) ? company.images[0] : null;

  const renderStars = (rating: number) => {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5 ? 1 : 0;
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - half);
  };

  const isExactCity = company.matchType === 'city';

  // Calculate robust default fallbacks for non-search companies
  const priceMin = company.priceMin !== undefined && company.priceMin !== null ? company.priceMin : company.ratePerKg;
  const priceMax = company.priceMax !== undefined && company.priceMax !== null ? company.priceMax : company.ratePerKg;

  const deliveryText = (company.deliveryDaysMin !== undefined && company.deliveryDaysMin !== null && company.deliveryDaysMax !== undefined && company.deliveryDaysMax !== null)
    ? (company.deliveryDaysMin === company.deliveryDaysMax ? `${company.deliveryDaysMin} days` : `${company.deliveryDaysMin}-${company.deliveryDaysMax} days`)
    : (company.deliveryTime || '3-5 days');

  return (
    <TouchableOpacity style={[s.card, isExactCity && s.cardExactCity]} onPress={() => onSelectCompany(company)} activeOpacity={0.7}>
      <View style={s.cardBody}>
        {/* Match Type Badge */}
        <View style={s.badgeRow}>
          {isExactCity ? (
            <View style={s.exactBadge}>
              <Text style={s.exactBadgeText}>🎯 Exact City Match</Text>
            </View>
          ) : (
            <View style={s.stateBadge}>
              <Text style={s.stateBadgeText}>🗺️ Region Coverage</Text>
            </View>
          )}
        </View>

        <View style={s.cardTop}>
          {thumbnail ? (
            <Image source={{ uri: thumbnail }} style={s.avatarImage as any} />
          ) : (
            <View style={s.avatarCircle}>
              <Text style={s.avatarText}>{company.name.charAt(0)}</Text>
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={s.companyName}>{company.name}</Text>
            <View style={s.locationRow}>
              <Text style={s.locationIcon}>📍</Text>
              <Text style={s.companyLocation}>{company.location}</Text>
            </View>
          </View>
          <View style={s.rateBadge}>
            <Text style={s.rateText}>₹{priceMin === priceMax ? priceMin : `${priceMin}-${priceMax}`}</Text>
            <Text style={s.rateUnit}>/kg</Text>
          </View>
        </View>

        <View style={s.ratingRow}>
          <Text style={s.stars}>{renderStars(company.rating)}</Text>
          <View style={s.ratingBadge}>
            <Text style={s.ratingNum}>{company.rating.toFixed(1)}</Text>
          </View>
          <Text style={s.ratingCount}>({company.totalRatings} reviews)</Text>
        </View>

        {/* Delivery Days display */}
        <View style={s.deliveryRow}>
          <Text style={s.deliveryIcon}>⏱️</Text>
          <Text style={s.deliveryText}>
            Delivery: {deliveryText}
          </Text>
        </View>

        <View style={s.routesRow}>
          {company.routes.slice(0, 3).map((r, i) => (
            <View key={i} style={s.routeChip}>
              <Text style={s.routeChipText}>{r}</Text>
            </View>
          ))}
          {company.routes.length > 3 && (
            <View style={s.moreChip}>
              <Text style={s.moreChipText}>+{company.routes.length - 3}</Text>
            </View>
          )}
        </View>

        <View style={s.cardFooter}>
          <Text style={s.estText}>Est. {company.established}</Text>
          <View style={s.detailsBtn}>
            <Text style={s.viewDetails}>View Details  →</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const BrowseCompaniesScreen = ({ onBack, onSelectCompany, ownerId }: Props) => {
  // Search Mode state: route search vs name search
  const [searchMode, setSearchMode] = useState<'route' | 'name'>('route');

  // Phase 1 Route Search states
  const [pickupCity, setPickupCity] = useState('Ludhiana');
  const [isEditingPickup, setIsEditingPickup] = useState(false);
  const [destinationQuery, setDestinationQuery] = useState('');
  const [allDestinations, setAllDestinations] = useState<Destination[]>([]);
  const [filteredDestinations, setFilteredDestinations] = useState<Destination[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isLoadingDestinations, setIsLoadingDestinations] = useState(true);

  // Name Search states
  const [nameQuery, setNameQuery] = useState('');
  const [selectedCompanyName, setSelectedCompanyName] = useState<string | null>(null);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [filteredCompaniesByName, setFilteredCompaniesByName] = useState<Company[]>([]);

  // Phase 2 Results states
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isSearchingCompanies, setIsSearchingCompanies] = useState(false);

  // Search correction state (Google/YouTube-style)
  const [resolvedQuery, setResolvedQuery] = useState<string | null>(null);
  const [isExactMatch, setIsExactMatch] = useState(true);

  // Custom transporter modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customDepot, setCustomDepot] = useState('');
  const [customPhone, setCustomPhone] = useState('');
  const [customDestination, setCustomDestination] = useState('');
  const [customRate, setCustomRate] = useState('');
  const [customDeliveryTime, setCustomDeliveryTime] = useState('2-5 days');
  const [isAdding, setIsAdding] = useState(false);

  const handleOpenAddModal = () => {
    setCustomName('');
    setCustomDepot('');
    setCustomPhone('');
    setCustomDestination(selectedDestination || destinationQuery || '');
    setCustomRate('');
    setCustomDeliveryTime('2-5 days');
    setShowAddModal(true);
  };

  const handleAddCustomTransporter = async () => {
    if (!customName.trim()) {
      Alert.alert('Required', 'Please enter the transporter name.');
      return;
    }
    if (!customDepot.trim()) {
      Alert.alert('Required', 'Please enter the depot/shipment address.');
      return;
    }

    setIsAdding(true);
    try {
      const res = await addCustomTransportCompany(ownerId, {
        name: customName.trim(),
        depotAddress: customDepot.trim(),
        contactPhone: customPhone.trim() || undefined,
        destination: customDestination.trim() || undefined,
        deliveryTime: customDeliveryTime.trim() || undefined,
        ratePerKg: Number(customRate) || 0,
      });

      if (res.success && res.company) {
        Alert.alert('Success', 'Your custom transporter has been added successfully and is now saved under your profile!');
        setShowAddModal(false);
        // Re-run the search query or fetch all to refresh the view immediately!
        if (searchMode === 'route' && (selectedDestination || destinationQuery)) {
          handleDestinationSelect(selectedDestination || destinationQuery);
        } else if (searchMode === 'name' && (selectedCompanyName || nameQuery)) {
          handleCompanySearch(selectedCompanyName || nameQuery);
        } else {
          const compRes = await fetchTransportCompanies(ownerId);
          if (compRes.success) {
            setAllCompanies(compRes.companies);
          }
        }
      } else {
        Alert.alert('Error', res.error || 'Failed to add custom transporter. Please try again.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An unexpected error occurred.');
    } finally {
      setIsAdding(false);
    }
  };

  // Load Pickup City, Destinations and Companies
  useEffect(() => {
    const loadInitialData = async () => {
      // 1. Fetch User Profile (resilient)
      try {
        const userRes = await fetchUserProfile(ownerId);
        if (userRes.success && userRes.user) {
          if (userRes.user.city) {
            setPickupCity(userRes.user.city);
          } else if (userRes.user.factory_address) {
            const parsedCity = extractCityFromAddress(userRes.user.factory_address);
            if (parsedCity) setPickupCity(parsedCity);
          }
        }
      } catch (err) {
        console.error('[BrowseCompaniesScreen] Resilient User profile error:', err);
      }

      // 2. Load recent searches
      try {
        const recentJson = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
        if (recentJson) {
          setRecentSearches(JSON.parse(recentJson));
        }
      } catch (err) {
        console.error('[BrowseCompaniesScreen] Resilient recent searches error:', err);
      }

      // 3. Fetch destinations (resilient)
      try {
        const destRes = await fetchDestinations();
        if (destRes.success && destRes.destinations.length > 0) {
          setAllDestinations(destRes.destinations);
        } else {
          console.log('[BrowseCompaniesScreen] API destinations unavailable, using fallback list');
          setAllDestinations(FALLBACK_DESTINATIONS);
        }
      } catch (err) {
        console.error('[BrowseCompaniesScreen] Resilient destinations error:', err);
        setAllDestinations(FALLBACK_DESTINATIONS);
      }

      // 4. Fetch transport companies (resilient)
      try {
        const compRes = await fetchTransportCompanies(ownerId);
        if (compRes.success) {
          setAllCompanies(compRes.companies);
        }
      } catch (err) {
        console.error('[BrowseCompaniesScreen] Resilient companies error:', err);
      } finally {
        setIsLoadingDestinations(false);
      }
    };

    loadInitialData();
  }, [ownerId]);

  // Handle destination autocomplete filtering (route search)
  useEffect(() => {
    if (!destinationQuery.trim()) {
      setFilteredDestinations([]);
      return;
    }

    const query = destinationQuery.trim();
    const queryLower = query.toLowerCase();
    const filtered = allDestinations.filter(
      (d) => {
        const dName = d.name ? String(d.name).toLowerCase() : '';
        const dState = d.state ? String(d.state).toLowerCase() : '';
        return (
          dName.includes(queryLower) ||
          dState.includes(queryLower) ||
          fuzzyMatch(dName, query) ||
          fuzzyMatch(dState, query)
        );
      }
    );
    setFilteredDestinations(filtered.slice(0, 10)); // Limit to top 10 matches
  }, [destinationQuery, allDestinations]);

  // Handle company name autocomplete filtering (name search)
  useEffect(() => {
    if (!nameQuery.trim()) {
      setFilteredCompaniesByName([]);
      return;
    }

    const query = nameQuery.trim().toLowerCase();
    const filtered = allCompanies.filter(
      (c) => {
        const cName = c.name ? String(c.name).toLowerCase() : '';
        return cName.includes(query) || fuzzyMatch(cName, query);
      }
    );
    setFilteredCompaniesByName(filtered.slice(0, 10)); // Limit to top 10 matches
  }, [nameQuery, allCompanies]);

  // Handle destination select (triggers search)
  const handleDestinationSelect = async (destName: string) => {
    setDestinationQuery(destName);
    setSelectedDestination(destName);
    setFilteredDestinations([]);

    // Save to recents
    const updatedRecents = [destName, ...recentSearches.filter((s) => s !== destName)].slice(0, 5);
    setRecentSearches(updatedRecents);
    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updatedRecents));

    // Execute Search — try API first, fallback to client-side filtering
    setIsSearchingCompanies(true);
    setResolvedQuery(null);
    setIsExactMatch(true);
    try {
      const res = await searchTransportCompanies(destName, pickupCity, ownerId);
      if (res.success && res.companies.length > 0) {
        setCompanies(res.companies);
        // Surface resolved query if the backend corrected the search term
        const resolved = (res as any).resolvedDestination as string | undefined;
        const exact = (res as any).isExactMatch as boolean | undefined;
        if (resolved) setResolvedQuery(resolved);
        setIsExactMatch(exact !== false);
      } else {
        // API search endpoint unavailable or returned 0 results — do client-side matching
        console.log('[BrowseCompaniesScreen] Search API unavailable or empty, falling back to client-side matching');
        const fallbackRes = await fetchTransportCompanies(ownerId);
        if (fallbackRes.success) {
          const filtered = filterCompaniesClientSide(fallbackRes.companies, destName, pickupCity);
          setCompanies(filtered);
        }
      }
    } catch (err) {
      console.error('[BrowseCompaniesScreen] Search error:', err);
    } finally {
      setIsSearchingCompanies(false);
    }
  };

  // Handle company name select (triggers name search)
  const handleCompanySearch = (compName: string) => {
    setNameQuery(compName);
    setSelectedCompanyName(compName);
    setFilteredCompaniesByName([]);
    setResolvedQuery(null);
    setIsExactMatch(true);

    const queryLower = compName.toLowerCase();
    const matched = allCompanies.filter(
      (c) => {
        const cName = c.name ? String(c.name).toLowerCase() : '';
        return cName.includes(queryLower) || fuzzyMatch(cName, compName);
      }
    );
    setCompanies(matched);

    // Detect if any result is an exact name match
    const hasExact = matched.some(
      (c) => c.name.toLowerCase() === queryLower
    );
    if (!hasExact && matched.length > 0) {
      // Fuzzy match — show the closest result name as the resolved term
      setResolvedQuery(matched[0].name);
      setIsExactMatch(false);
    }
  };

  const handleClearSearch = () => {
    setSelectedDestination(null);
    setDestinationQuery('');
    setSelectedCompanyName(null);
    setNameQuery('');
    setCompanies([]);
    setFilteredDestinations([]);
    setFilteredCompaniesByName([]);
    setResolvedQuery(null);
    setIsExactMatch(true);
  };

  const hasSelection = searchMode === 'route' ? !!selectedDestination : !!selectedCompanyName;

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header / Google Maps style Search Bar */}
      <View style={s.searchHeader}>
        <View style={s.searchBarContainer}>
          <TouchableOpacity onPress={hasSelection ? handleClearSearch : onBack} style={s.searchBackBtn}>
            <Text style={s.searchBackArrow}>{hasSelection ? '✕' : '←'}</Text>
          </TouchableOpacity>

          <View style={s.inputsContainer}>
            {searchMode === 'route' ? (
              <>
                {/* Pickup Input (styled pill-like, prefilled) */}
                <View style={s.pickupRowContainer}>
                  <View style={s.greenDot} />
                  {isEditingPickup ? (
                    <TextInput
                      style={s.pickupTextInput}
                      value={pickupCity}
                      onChangeText={setPickupCity}
                      onBlur={() => setIsEditingPickup(false)}
                      autoFocus
                      placeholder="Enter pickup city"
                    />
                  ) : (
                    <TouchableOpacity onPress={() => setIsEditingPickup(true)} style={s.pickupCityPill}>
                      <Text style={s.pickupCityLabel}>From: </Text>
                      <Text style={s.pickupCityValue}>{pickupCity}</Text>
                      <Text style={s.editIcon}> ✏️</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Divider */}
                <View style={s.searchDivider} />

                {/* Destination Input */}
                <View style={s.destRowContainer}>
                  <View style={s.redDot} />
                  {selectedDestination ? (
                    <View style={s.selectedDestContainer}>
                      <Text style={s.selectedDestText} numberOfLines={1}>{selectedDestination}</Text>
                      <TouchableOpacity onPress={handleClearSearch} style={s.clearBtn}>
                        <Text style={s.clearBtnText}>Change</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TextInput
                      style={s.destInput}
                      placeholder="Where is the destination? (City or State)"
                      placeholderTextColor="#9CA3AF"
                      value={destinationQuery}
                      onChangeText={setDestinationQuery}
                      autoFocus={!selectedDestination}
                      returnKeyType="search"
                      onSubmitEditing={() => {
                        if (destinationQuery.trim()) {
                          handleDestinationSelect(destinationQuery.trim());
                        }
                      }}
                    />
                  )}
                </View>
              </>
            ) : (
              /* Company Name Input */
              <View style={s.destRowContainer}>
                <View style={[s.redDot, { backgroundColor: '#10B981' }]} />
                {selectedCompanyName ? (
                  <View style={s.selectedDestContainer}>
                    <Text style={s.selectedDestText} numberOfLines={1}>{selectedCompanyName}</Text>
                    <TouchableOpacity onPress={handleClearSearch} style={s.clearBtn}>
                      <Text style={s.clearBtnText}>Change</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TextInput
                    style={s.destInput}
                    placeholder="Search transport company by name..."
                    placeholderTextColor="#9CA3AF"
                    value={nameQuery}
                    onChangeText={setNameQuery}
                    autoFocus={!selectedCompanyName}
                    returnKeyType="search"
                    onSubmitEditing={() => {
                      if (nameQuery.trim()) {
                        handleCompanySearch(nameQuery.trim());
                      }
                    }}
                  />
                )}
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Selector Tabs */}
      <View style={s.tabContainer}>
        <TouchableOpacity
          style={[s.tabButton, searchMode === 'route' && s.tabButtonActive]}
          onPress={() => {
            setSearchMode('route');
            handleClearSearch();
          }}
        >
          <Text style={[s.tabButtonText, searchMode === 'route' && s.tabButtonTextActive]}>🗺️ Search by Route</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tabButton, searchMode === 'name' && s.tabButtonActive]}
          onPress={() => {
            setSearchMode('name');
            handleClearSearch();
            if (allCompanies.length === 0) {
              fetchTransportCompanies(ownerId).then((compRes) => {
                if (compRes.success) {
                  setAllCompanies(compRes.companies);
                }
              });
            }
          }}
        >
          <Text style={[s.tabButtonText, searchMode === 'name' && s.tabButtonTextActive]}>🏢 Search by Name</Text>
        </TouchableOpacity>
      </View>

      {/* Content Area */}
      {hasSelection ? (
        /* Results Mode */
        isSearchingCompanies ? (
          <View style={s.centerContainer}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={s.loadingText}>Finding transport companies...</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.resultsScroll} showsVerticalScrollIndicator={false}>
            {/* Google/YouTube-style correction banner */}
            {!isExactMatch && resolvedQuery && (
              <View style={s.correctionBanner}>
                <Text style={s.correctionBannerText}>
                  Showing results for:{' '}
                  <Text style={s.correctionBannerBold}>{resolvedQuery}</Text>
                </Text>
                <Text style={s.correctionBannerSub}>
                  Search instead for:{' '}
                  <Text
                    style={s.correctionBannerLink}
                    onPress={() => {
                      // Re-run with original user query verbatim
                      if (searchMode === 'route') handleDestinationSelect(selectedDestination || destinationQuery);
                      else handleCompanySearch(nameQuery);
                    }}
                  >
                    {searchMode === 'route' ? selectedDestination : selectedCompanyName}
                  </Text>
                </Text>
              </View>
            )}

            {/* Results count header */}
            <View style={s.resultsMetaRow}>
              <Text style={s.resultsMetaText}>
                {searchMode === 'route'
                  ? `${companies.length} companies serve ${pickupCity} → ${resolvedQuery && !isExactMatch ? resolvedQuery : selectedDestination}`
                  : `${companies.length} companies match "${selectedCompanyName}"`
                }
              </Text>
            </View>

            {companies.length > 0 ? (
              companies.map((c) => (
                <CompanyCardItem key={c.id} company={c} onSelectCompany={(comp) => onSelectCompany(searchMode === 'route' ? { ...comp, searchedDestination: selectedDestination || undefined } : comp)} />
              ))
            ) : (
              <View style={s.emptyState}>
                <Text style={s.emptyIcon}>🚚</Text>
                <Text style={s.emptyTitle}>No Transporters Found</Text>
                <Text style={s.emptySub}>
                  {searchMode === 'route'
                    ? `No transport company covers route to "${selectedDestination}" yet. Try searching for a different destination or a state.`
                    : `No transport company matches "${selectedCompanyName}".`
                  }
                </Text>
              </View>
            )}

            {/* Custom Transporter option at bottom */}
            <View style={s.customTransporterPromptCard}>
              <Text style={s.customPromptTitle}>Not your transporter?</Text>
              <Text style={s.customPromptSub}>Add your own private transporter that only you can see and book.</Text>
              <TouchableOpacity style={s.addCustomBtn} onPress={handleOpenAddModal}>
                <Text style={s.addCustomBtnText}>+ Add Yours</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )
      ) : (
        /* Autocomplete / Suggestions Mode */
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
          {searchMode === 'route' ? (
            <>
              {/* Quick Search Button */}
              {destinationQuery.trim().length > 0 && filteredDestinations.length === 0 && (
                <TouchableOpacity
                  style={s.quickSearchBtn}
                  onPress={() => handleDestinationSelect(destinationQuery.trim())}
                >
                  <Text style={s.quickSearchIcon}>🔍</Text>
                  <Text style={s.quickSearchText}>Search for "{destinationQuery.trim()}"</Text>
                  <Text style={s.quickSearchArrow}>→</Text>
                </TouchableOpacity>
              )}
              {/* Autocomplete List */}
              {filteredDestinations.length > 0 && (
                <View style={s.suggestionsCard}>
                  <FlatList
                    data={filteredDestinations}
                    keyExtractor={(item, index) => `${item.name}_${index}`}
                    scrollEnabled={false}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={s.suggestionItem}
                        onPress={() => handleDestinationSelect(item.name)}
                      >
                        <Text style={s.suggestionIcon}>{item.type === 'state' ? '🗺️' : '📍'}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={s.suggestionName}>{item.name}</Text>
                          <Text style={s.suggestionSub}>
                            {item.type === 'state' ? 'State' : `City in ${item.state}`}
                          </Text>
                        </View>
                        <Text style={s.suggestionSelectArrow}>→</Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              )}

              {/* Recent Searches */}
              {!destinationQuery && recentSearches.length > 0 && (
                <View style={s.recentsContainer}>
                  <Text style={s.sectionHeader}>Recent Searches</Text>
                  {recentSearches.map((search, i) => (
                    <TouchableOpacity
                      key={i}
                      style={s.recentItem}
                      onPress={() => handleDestinationSelect(search)}
                    >
                      <Text style={s.recentIcon}>🕒</Text>
                      <Text style={s.recentText}>{search}</Text>
                      <Text style={s.recentArrow}>→</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Helpful prompt */}
              {!destinationQuery && recentSearches.length === 0 && (
                <View style={s.promptContainer}>
                  <Text style={s.promptIcon}>🗺️</Text>
                  <Text style={s.promptTitle}>Search Destination City</Text>
                  <Text style={s.promptSub}>
                    Type the city or state where your shipment needs to go. We'll show you transport companies that deliver there.
                  </Text>
                </View>
              )}
            </>
          ) : (
            <>
              {/* Quick Search Button */}
              {nameQuery.trim().length > 0 && filteredCompaniesByName.length === 0 && (
                <TouchableOpacity
                  style={s.quickSearchBtn}
                  onPress={() => handleCompanySearch(nameQuery.trim())}
                >
                  <Text style={s.quickSearchIcon}>🔍</Text>
                  <Text style={s.quickSearchText}>Search for "{nameQuery.trim()}"</Text>
                  <Text style={s.quickSearchArrow}>→</Text>
                </TouchableOpacity>
              )}
              {/* Autocomplete List */}
              {filteredCompaniesByName.length > 0 && (
                <View style={s.suggestionsCard}>
                  <FlatList
                    data={filteredCompaniesByName}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={s.suggestionItem}
                        onPress={() => handleCompanySearch(item.name)}
                      >
                        <Text style={s.suggestionIcon}>🏢</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={s.suggestionName}>{item.name}</Text>
                          <Text style={s.suggestionSub}>
                            📍 Depot: {item.location}
                          </Text>
                        </View>
                        <Text style={s.suggestionSelectArrow}>→</Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              )}

              {/* Helpful prompt */}
              {!nameQuery && (
                <View style={s.promptContainer}>
                  <Text style={s.promptIcon}>🏢</Text>
                  <Text style={s.promptTitle}>Search by Company Name</Text>
                  <Text style={s.promptSub}>
                    Type the name of a transport company (e.g. "RanCargo", "GoZo") to view their profile, depot addresses, and covered routes.
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* Add Custom Transporter Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add Custom Transporter</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={s.modalCloseBtn}>
                <Text style={s.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={s.modalForm} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={s.modalInfoText}>
                Create a private transporter profile. Only you can view, search, and book this transporter.
              </Text>

              {/* Form Fields */}
              <View style={s.formField}>
                <Text style={s.fieldLabel}>Transporter Name <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <TextInput
                  style={s.formInput}
                  placeholder="e.g. Mata Transport"
                  placeholderTextColor="#9CA3AF"
                  value={customName}
                  onChangeText={setCustomName}
                />
              </View>

              <View style={s.formField}>
                <Text style={s.fieldLabel}>Depot / Shipment Address <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <TextInput
                  style={s.formInput}
                  placeholder="e.g. Focal Point, Jalandhar"
                  placeholderTextColor="#9CA3AF"
                  value={customDepot}
                  onChangeText={setCustomDepot}
                />
              </View>

              <View style={s.formField}>
                <Text style={s.fieldLabel}>Delivery Route / Destination City</Text>
                <TextInput
                  style={s.formInput}
                  placeholder="e.g. Ludhiana, Kolkata"
                  placeholderTextColor="#9CA3AF"
                  value={customDestination}
                  onChangeText={setCustomDestination}
                />
              </View>

              <View style={s.formField}>
                <Text style={s.fieldLabel}>Contact Phone Number</Text>
                <TextInput
                  style={s.formInput}
                  placeholder="e.g. 9876543210"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                  value={customPhone}
                  onChangeText={setCustomPhone}
                />
              </View>

              <View style={s.formField}>
                <Text style={s.fieldLabel}>Estimated Delivery Days</Text>
                <TextInput
                  style={s.formInput}
                  placeholder="e.g. 2-5 days"
                  placeholderTextColor="#9CA3AF"
                  value={customDeliveryTime}
                  onChangeText={setCustomDeliveryTime}
                />
              </View>

              <View style={s.formField}>
                <Text style={s.fieldLabel}>Custom Rate (₹ per Kg) - Optional</Text>
                <TextInput
                  style={s.formInput}
                  placeholder="e.g. 5"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  value={customRate}
                  onChangeText={setCustomRate}
                />
              </View>
            </ScrollView>

            <View style={s.modalActions}>
              <TouchableOpacity
                style={[s.modalCancelBtn]}
                onPress={() => setShowAddModal(false)}
                disabled={isAdding}
              >
                <Text style={s.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalConfirmBtn]}
                onPress={handleAddCustomTransporter}
                disabled={isAdding}
              >
                {isAdding ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={s.modalConfirmBtnText}>Save Transporter</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  correctionBanner: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
  },
  correctionBannerText: {
    fontSize: 14,
    color: '#D97706',
  },
  correctionBannerBold: {
    fontWeight: 'bold',
    fontStyle: 'italic',
  },
  correctionBannerSub: {
    fontSize: 12,
    color: '#78350F',
    marginTop: 4,
  },
  correctionBannerLink: {
    textDecorationLine: 'underline',
    fontWeight: 'bold',
    color: '#2563EB',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginHorizontal: 16,
    marginVertical: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabButtonTextActive: {
    color: '#10B981',
    fontWeight: '800',
  },
  // Search Header
  searchHeader: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 16 : 64,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginRight: 10,
    elevation: 1,
  },
  searchBackArrow: {
    fontSize: 18,
    color: '#374151',
    fontWeight: '800',
  },
  inputsContainer: {
    flex: 1,
  },
  pickupRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 10,
  },
  pickupCityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F7F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  pickupCityLabel: {
    fontSize: 12,
    color: '#065F46',
    fontWeight: '600',
  },
  pickupCityValue: {
    fontSize: 12,
    color: '#065F46',
    fontWeight: '800',
  },
  editIcon: {
    fontSize: 10,
  },
  pickupTextInput: {
    flex: 1,
    height: 32,
    fontSize: 14,
    color: '#111827',
    padding: 0,
    fontWeight: '700',
  },
  searchDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 6,
    marginLeft: 18,
  },
  destRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 10,
  },
  destInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
    padding: 0,
  },
  selectedDestContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedDestText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    flex: 1,
  },
  clearBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  clearBtnText: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '800',
  },

  // Suggestion list
  suggestionsCard: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  suggestionIcon: {
    fontSize: 20,
    marginRight: 16,
  },
  suggestionName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F2937',
  },
  suggestionSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '500',
  },
  suggestionSelectArrow: {
    fontSize: 16,
    color: '#9CA3AF',
    fontWeight: '600',
  },

  // Recents
  recentsContainer: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  recentIcon: {
    fontSize: 16,
    color: '#9CA3AF',
    marginRight: 14,
  },
  recentText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  recentArrow: {
    fontSize: 14,
    color: '#9CA3AF',
  },

  // Results mode
  resultsScroll: {
    padding: 16,
    paddingBottom: 40,
  },
  resultsMetaRow: {
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  resultsMetaText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 10,
    fontWeight: '600',
  },

  // Cards
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  cardExactCity: {
    borderColor: '#A7F3D0', // Green border for exact matches
  },
  cardBody: {
    padding: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  exactBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  exactBadgeText: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: '800',
  },
  stateBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stateBadgeText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '800',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#10B981',
  },
  companyName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  locationIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  companyLocation: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '600',
  },
  rateBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: '#E6F7F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  rateText: {
    color: '#10B981',
    fontWeight: '900',
    fontSize: 15,
  },
  rateUnit: {
    color: '#10B981',
    fontWeight: '700',
    fontSize: 11,
    marginLeft: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  stars: {
    color: '#F59E0B',
    fontSize: 14,
    letterSpacing: 1,
  },
  ratingBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  ratingNum: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B45309',
  },
  ratingCount: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 6,
    fontWeight: '600',
  },
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  deliveryIcon: {
    fontSize: 12,
    marginRight: 6,
  },
  deliveryText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '700',
  },
  routesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 6,
  },
  routeChip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  routeChipText: {
    fontSize: 10,
    color: '#374151',
    fontWeight: '700',
  },
  moreChip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  moreChipText: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '800',
  },
  cardFooter: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  estText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '700',
  },
  detailsBtn: {
    paddingVertical: 2,
  },
  viewDetails: {
    fontSize: 13,
    fontWeight: '800',
    color: '#10B981',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    marginTop: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
  },

  // Helper prompts
  promptContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 60,
  },
  promptIcon: {
    fontSize: 56,
    marginBottom: 20,
  },
  promptTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#374151',
    marginBottom: 10,
  },
  promptSub: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },

  // Quick Search Button
  quickSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  quickSearchIcon: {
    fontSize: 18,
    marginRight: 14,
  },
  quickSearchText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#10B981',
  },
  quickSearchArrow: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: '800',
  },

  // Custom Transporter Styles
  customTransporterPromptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  customPromptTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  customPromptSub: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
    paddingHorizontal: 10,
    fontWeight: '500',
  },
  addCustomBtn: {
    backgroundColor: '#E6F7F0',
    borderColor: '#10B981',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  addCustomBtnText: {
    color: '#10B981',
    fontWeight: '800',
    fontSize: 14,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 18,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  modalForm: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  modalInfoText: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    fontWeight: '500',
  },
  formField: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#374151',
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalCancelBtnText: {
    color: '#4B5563',
    fontWeight: '800',
    fontSize: 15,
  },
  modalConfirmBtn: {
    flex: 2,
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalConfirmBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
});

export default BrowseCompaniesScreen;
export type { Company };
