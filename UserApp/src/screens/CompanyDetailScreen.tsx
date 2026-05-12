import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Company } from './BrowseCompaniesScreen';

type Props = {
  company: Company;
  onBack: () => void;
  onBookNow: () => void;
};

const CompanyDetailScreen = ({ company, onBack, onBookNow }: Props) => {
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
        <Text style={s.headerTitle}>Company Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {/* Company Card */}
        <View style={s.heroCard}>
          <View style={s.avatarLarge}>
            <Text style={s.avatarText}>{company.name.charAt(0)}</Text>
          </View>
          <Text style={s.companyName}>{company.name}</Text>
          <Text style={s.location}>📍 {company.location}</Text>
          <View style={s.ratingRow}>
            <Text style={s.stars}>{renderStars(company.rating)}</Text>
            <Text style={s.ratingNum}>{company.rating}</Text>
            <Text style={s.ratingCount}>({company.totalRatings} ratings)</Text>
          </View>
          <Text style={s.established}>Est. {company.established}</Text>
        </View>

        {/* Rate & Depot */}
        <View style={s.infoCard}>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Rate per kg</Text>
            <Text style={s.infoValue}>₹{company.ratePerKg}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Depot Address</Text>
            <Text style={[s.infoValue, { fontSize: 13, textAlign: 'right', flex: 1, marginLeft: 12 }]}>{company.depotAddress}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Contact</Text>
            <Text style={s.infoValue}>📞 {company.contactPhone}</Text>
          </View>
        </View>

        {/* Description */}
        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>About</Text>
          <Text style={s.descText}>{company.description}</Text>
        </View>

        {/* Routes */}
        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>Routes Covered</Text>
          {company.routes.map((route, i) => (
            <View key={i} style={s.routeItem}>
              <Text style={s.routeIcon}>🛣️</Text>
              <Text style={s.routeText}>{route}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={s.bottomCta}>
        <TouchableOpacity style={s.bookBtn} onPress={onBookNow} activeOpacity={0.8}>
          <Text style={s.bookBtnText}>Book Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backArrow: { fontSize: 24, color: '#111827', fontWeight: '300' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  heroCard: { backgroundColor: '#FFF', borderRadius: 18, padding: 24, alignItems: 'center', elevation: 3, borderWidth: 1, borderColor: '#F3F4F6' },
  avatarLarge: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#1A56DB', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#FFF' },
  companyName: { fontSize: 22, fontWeight: '800', color: '#111827' },
  location: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  stars: { color: '#F59E0B', fontSize: 16 },
  ratingNum: { marginLeft: 6, fontSize: 15, fontWeight: '700', color: '#111827' },
  ratingCount: { fontSize: 13, color: '#9CA3AF', marginLeft: 4 },
  established: { fontSize: 12, color: '#9CA3AF', marginTop: 6 },
  infoCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginTop: 12, elevation: 2, borderWidth: 1, borderColor: '#F3F4F6' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  infoLabel: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  infoValue: { fontSize: 15, fontWeight: '700', color: '#111827' },
  divider: { height: 1, backgroundColor: '#F3F4F6' },
  sectionCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginTop: 12, elevation: 2, borderWidth: 1, borderColor: '#F3F4F6' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10 },
  descText: { fontSize: 14, color: '#374151', lineHeight: 22 },
  routeItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  routeIcon: { fontSize: 16, marginRight: 10 },
  routeText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  bottomCta: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#E5E7EB', elevation: 10 },
  bookBtn: { backgroundColor: '#1A56DB', borderRadius: 14, paddingVertical: 16, elevation: 2 },
  bookBtnText: { color: '#FFF', textAlign: 'center', fontSize: 17, fontWeight: '700' },
});

export default CompanyDetailScreen;
