import React, { useEffect, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, Platform, Image, ActivityIndicator } from 'react-native';
import { fetchCompanyImages, fetchTransportCompanies } from '../api';

type Company = {
  id: string; name: string; location: string; ratePerKg: number; rateDisplay?: string;
  rating: number; totalRatings: number; routes: string[];
  depotAddress: string; description: string; established: string; contactPhone: string;
};

type Props = {
  onBack: () => void;
  onSelectCompany: (company: Company) => void;
};

const CompanyCardItem = ({ company, onSelectCompany }: { company: Company, onSelectCompany: (company: Company) => void }) => {
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  useEffect(() => {
    const loadThumbnail = async () => {
      const res = await fetchCompanyImages(company.id);
      if (res.success && res.images && res.images.length > 0) {
        setThumbnail(res.images[0]);
      }
    };
    loadThumbnail();
  }, [company.id]);

  const renderStars = (rating: number) => {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5 ? 1 : 0;
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - half);
  };

  return (
    <TouchableOpacity style={s.card} onPress={() => onSelectCompany(company)} activeOpacity={0.7}>
      {/* Accent strip */}
      <View style={s.cardAccent} />

      <View style={s.cardBody}>
        <View style={s.cardTop}>
          {thumbnail ? (
            <Image source={{ uri: thumbnail }} style={s.avatarImage} />
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
            <Text style={s.rateText}>₹{company.rateDisplay || company.ratePerKg}</Text>
            <Text style={s.rateUnit}>/kg</Text>
          </View>
        </View>

        <View style={s.ratingRow}>
          <Text style={s.stars}>{renderStars(company.rating)}</Text>
          <View style={s.ratingBadge}>
            <Text style={s.ratingNum}>{company.rating}</Text>
          </View>
          <Text style={s.ratingCount}>({company.totalRatings} reviews)</Text>
        </View>

        <View style={s.routesRow}>
          {company.routes.slice(0, 2).map((r, i) => (
            <View key={i} style={s.routeChip}>
              <Text style={s.routeChipText}>{r}</Text>
            </View>
          ))}
          {company.routes.length > 2 && (
            <View style={s.moreChip}>
              <Text style={s.moreChipText}>+{company.routes.length - 2}</Text>
            </View>
          )}
        </View>

        <View style={s.cardFooter}>
          <Text style={s.estText}>Est. {company.established}</Text>
          <TouchableOpacity style={s.detailsBtn} onPress={() => onSelectCompany(company)}>
            <Text style={s.viewDetails}>View Details  →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const BrowseCompaniesScreen = ({ onBack, onSelectCompany }: Props) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const res = await fetchTransportCompanies();
        if (res.success) {
          setCompanies(res.companies);
        }
      } catch (err) {
        console.error('Failed to fetch companies:', err);
      } finally {
        setLoading(false);
      }
    };
    loadCompanies();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#F0F4F8' }}>
      <StatusBar barStyle="light-content" backgroundColor="#1A56DB" />

      {/* Gradient-style Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Transport Companies</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Hero Banner */}
      <View style={s.bannerWrap}>
        <View style={s.banner}>
          <View>
            <Text style={s.bannerTitle}>{loading ? 'Loading...' : `${companies.length} Companies Available`}</Text>
            <Text style={s.bannerSub}>Choose your trusted transport partner</Text>
          </View>
          <View style={s.bannerIconWrap}>
            <Text style={{ fontSize: 32 }}>🚛</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
          {companies.map((c) => (
            <CompanyCardItem key={c.id} company={c} onSelectCompany={onSelectCompany} />
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 18,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 56,
    backgroundColor: '#1E1B4B',
  },
  backBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  backArrow: { fontSize: 20, color: '#FFFFFF', fontWeight: '700' },
  headerTitle: { flex: 1, fontSize: 19, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', letterSpacing: 0.4 },

  // Banner
  bannerWrap: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 },
  banner: {
    backgroundColor: '#312E81',
    borderRadius: 20, padding: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    elevation: 6,
    shadowColor: '#1E1B4B', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 10,
  },
  bannerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: 0.2 },
  bannerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4, fontWeight: '500' },
  bannerIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },

  // Card
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF', borderRadius: 22,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#6366F1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8,
    borderWidth: 1.5,
    borderColor: '#EEF2F6',
    overflow: 'hidden',
  },
  cardAccent: {
    width: 5, backgroundColor: '#6366F1', borderTopLeftRadius: 22, borderBottomLeftRadius: 22,
  },
  cardBody: { flex: 1, padding: 18 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: {
    width: 50, height: 50, borderRadius: 16,
    backgroundColor: '#EEF2F6',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#D9F1FF',
  },
  avatarImage: {
    width: 50, height: 50, borderRadius: 16,
    borderWidth: 1.5, borderColor: '#D9F1FF',
  },
  avatarText: { fontSize: 22, fontWeight: '900', color: '#6366F1' },
  companyName: { fontSize: 17, fontWeight: '800', color: '#0F172A', letterSpacing: 0.1 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  locationIcon: { fontSize: 12, marginRight: 4 },
  companyLocation: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  rateBadge: {
    flexDirection: 'row', alignItems: 'baseline',
    backgroundColor: '#D1FAE5', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: '#A7F3D0',
  },
  rateText: { color: '#065F46', fontWeight: '900', fontSize: 16 },
  rateUnit: { color: '#065F46', fontWeight: '700', fontSize: 12, marginLeft: 1 },

  // Rating
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  stars: { color: '#F59E0B', fontSize: 14, letterSpacing: 1 },
  ratingBadge: {
    backgroundColor: '#FEF3C7', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2, marginLeft: 8,
  },
  ratingNum: { fontSize: 12, fontWeight: '850', color: '#B45309' },
  ratingCount: { fontSize: 12, color: '#94A3B8', marginLeft: 6, fontWeight: '600' },

  // Routes
  routesRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, gap: 6 },
  routeChip: {
    backgroundColor: '#EEF2F6', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  routeChipText: { fontSize: 11, color: '#475569', fontWeight: '700' },
  moreChip: {
    backgroundColor: '#F1F5F9', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  moreChipText: { fontSize: 11, color: '#64748B', fontWeight: '800' },

  // Footer
  cardFooter: {
    marginTop: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9',
    paddingTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  estText: { fontSize: 12, color: '#94A3B8', fontWeight: '700' },
  detailsBtn: { paddingVertical: 2 },
  viewDetails: { fontSize: 14, fontWeight: '800', color: '#6366F1', letterSpacing: 0.2 },
});

export default BrowseCompaniesScreen;
export type { Company };
