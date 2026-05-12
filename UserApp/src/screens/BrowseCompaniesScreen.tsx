import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { fetchTransportCompanies } from '../api';

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
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetchTransportCompanies();
      if (res.success) setCompanies(res.companies);
      setLoading(false);
    })();
  }, []);

  const renderStars = (rating: number) => {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5 ? 1 : 0;
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - half);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Transport Companies</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.banner}>
        <View>
          <Text style={s.bannerTitle}>{companies.length} companies available</Text>
          <Text style={s.bannerSub}>Choose a transport partner</Text>
        </View>
        <Text style={{ fontSize: 28 }}>🚛</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1A56DB" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
          {companies.map((c) => (
            <TouchableOpacity key={c.id} style={s.card} onPress={() => onSelectCompany(c)} activeOpacity={0.7}>
              <View style={s.cardTop}>
                <View style={s.avatarCircle}>
                  <Text style={s.avatarText}>{c.name.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.companyName}>{c.name}</Text>
                  <Text style={s.companyLocation}>📍 {c.location}</Text>
                </View>
                <View style={s.rateBadge}>
                  <Text style={s.rateText}>₹{c.ratePerKg}/kg</Text>
                </View>
              </View>

              <View style={s.ratingRow}>
                <Text style={s.stars}>{renderStars(c.rating)}</Text>
                <Text style={s.ratingNum}>{c.rating}</Text>
                <Text style={s.ratingCount}>({c.totalRatings})</Text>
              </View>

              <View style={s.routesRow}>
                {c.routes.slice(0, 2).map((r, i) => (
                  <View key={i} style={s.routeChip}>
                    <Text style={s.routeChipText}>{r}</Text>
                  </View>
                ))}
                {c.routes.length > 2 && (
                  <Text style={s.moreRoutes}>+{c.routes.length - 2} more</Text>
                )}
              </View>

              <View style={s.cardFooter}>
                <Text style={s.viewDetails}>View Details →</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backArrow: { fontSize: 24, color: '#111827', fontWeight: '300' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  banner: { marginHorizontal: 16, marginTop: 12, backgroundColor: '#1A56DB', borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bannerTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  bannerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, borderWidth: 1, borderColor: '#F3F4F6' },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#1A56DB' },
  companyName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  companyLocation: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  rateBadge: { backgroundColor: '#DCFCE7', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  rateText: { color: '#166534', fontWeight: '700', fontSize: 13 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  stars: { color: '#F59E0B', fontSize: 14 },
  ratingNum: { marginLeft: 6, fontSize: 13, fontWeight: '700', color: '#111827' },
  ratingCount: { fontSize: 12, color: '#9CA3AF', marginLeft: 3 },
  routesRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 6 },
  routeChip: { backgroundColor: '#F0F9FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#E0F2FE' },
  routeChipText: { fontSize: 11, color: '#0369A1', fontWeight: '600' },
  moreRoutes: { fontSize: 12, color: '#6B7280', alignSelf: 'center', marginLeft: 4 },
  cardFooter: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10, alignItems: 'flex-end' },
  viewDetails: { fontSize: 13, fontWeight: '700', color: '#1A56DB' },
});

export default BrowseCompaniesScreen;
export type { Company };
