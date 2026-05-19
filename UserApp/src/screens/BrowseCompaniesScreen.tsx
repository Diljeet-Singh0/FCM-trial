import React from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import { TRANSPORT_COMPANIES } from '../transporters';

type Company = {
  id: string; name: string; location: string; ratePerKg: number;
  rating: number; totalRatings: number; routes: string[];
  depotAddress: string; description: string; established: string; contactPhone: string;
};

type Props = {
  onBack: () => void;
  onSelectCompany: (company: Company) => void;
};

const BrowseCompaniesScreen = ({ onBack, onSelectCompany }: Props) => {
  const companies: Company[] = TRANSPORT_COMPANIES;

  const renderStars = (rating: number) => {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5 ? 1 : 0;
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - half);
  };

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
            <Text style={s.bannerTitle}>{companies.length} Companies Available</Text>
            <Text style={s.bannerSub}>Choose your trusted transport partner</Text>
          </View>
          <View style={s.bannerIconWrap}>
            <Text style={{ fontSize: 32 }}>🚛</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        {companies.map((c) => (
          <TouchableOpacity key={c.id} style={s.card} onPress={() => onSelectCompany(c)} activeOpacity={0.7}>
            {/* Accent strip */}
            <View style={s.cardAccent} />

            <View style={s.cardBody}>
              <View style={s.cardTop}>
                <View style={s.avatarCircle}>
                  <Text style={s.avatarText}>{c.name.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={s.companyName}>{c.name}</Text>
                  <View style={s.locationRow}>
                    <Text style={s.locationIcon}>📍</Text>
                    <Text style={s.companyLocation}>{c.location}</Text>
                  </View>
                </View>
                <View style={s.rateBadge}>
                  <Text style={s.rateText}>₹{c.ratePerKg}</Text>
                  <Text style={s.rateUnit}>/kg</Text>
                </View>
              </View>

              <View style={s.ratingRow}>
                <Text style={s.stars}>{renderStars(c.rating)}</Text>
                <View style={s.ratingBadge}>
                  <Text style={s.ratingNum}>{c.rating}</Text>
                </View>
                <Text style={s.ratingCount}>({c.totalRatings} reviews)</Text>
              </View>

              <View style={s.routesRow}>
                {c.routes.slice(0, 2).map((r, i) => (
                  <View key={i} style={s.routeChip}>
                    <Text style={s.routeChipText}>{r}</Text>
                  </View>
                ))}
                {c.routes.length > 2 && (
                  <View style={s.moreChip}>
                    <Text style={s.moreChipText}>+{c.routes.length - 2}</Text>
                  </View>
                )}
              </View>

              <View style={s.cardFooter}>
                <Text style={s.estText}>Est. {c.established}</Text>
                <TouchableOpacity style={s.detailsBtn} onPress={() => onSelectCompany(c)}>
                  <Text style={s.viewDetails}>View Details  →</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 52,
    backgroundColor: '#1A56DB',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },
  backArrow: { fontSize: 22, color: '#FFFFFF', fontWeight: '400' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', letterSpacing: 0.3 },

  // Banner
  bannerWrap: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  banner: {
    backgroundColor: '#0F3D91',
    borderRadius: 16, padding: 18,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    elevation: 4,
    shadowColor: '#1A56DB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8,
  },
  bannerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
  bannerSub: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 3, fontWeight: '500' },
  bannerIconWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },

  // Card
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF', borderRadius: 16,
    marginBottom: 14,
    elevation: 3,
    shadowColor: '#1A3B6D', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8,
    overflow: 'hidden',
  },
  cardAccent: {
    width: 4, backgroundColor: '#1A56DB', borderTopLeftRadius: 16, borderBottomLeftRadius: 16,
  },
  cardBody: { flex: 1, padding: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: '#EBF0FF',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#D6E0FF',
  },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#1A56DB' },
  companyName: { fontSize: 16, fontWeight: '700', color: '#0F172A', letterSpacing: 0.1 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  locationIcon: { fontSize: 12, marginRight: 4 },
  companyLocation: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  rateBadge: {
    flexDirection: 'row', alignItems: 'baseline',
    backgroundColor: '#ECFDF5', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#A7F3D0',
  },
  rateText: { color: '#059669', fontWeight: '800', fontSize: 15 },
  rateUnit: { color: '#059669', fontWeight: '600', fontSize: 11, marginLeft: 1 },

  // Rating
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  stars: { color: '#F59E0B', fontSize: 14, letterSpacing: 1 },
  ratingBadge: {
    backgroundColor: '#FEF3C7', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2, marginLeft: 8,
  },
  ratingNum: { fontSize: 12, fontWeight: '800', color: '#B45309' },
  ratingCount: { fontSize: 12, color: '#94A3B8', marginLeft: 5, fontWeight: '500' },

  // Routes
  routesRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 6 },
  routeChip: {
    backgroundColor: '#F0F9FF', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: '#BAE6FD',
  },
  routeChipText: { fontSize: 11, color: '#0369A1', fontWeight: '600' },
  moreChip: {
    backgroundColor: '#F1F5F9', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 5,
  },
  moreChipText: { fontSize: 11, color: '#64748B', fontWeight: '700' },

  // Footer
  cardFooter: {
    marginTop: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9',
    paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  estText: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  detailsBtn: { paddingVertical: 2 },
  viewDetails: { fontSize: 13, fontWeight: '700', color: '#1A56DB', letterSpacing: 0.2 },
});

export default BrowseCompaniesScreen;
export type { Company };
