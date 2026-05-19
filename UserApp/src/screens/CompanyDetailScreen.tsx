import React from 'react';
import { Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
    <View style={{ flex: 1, backgroundColor: '#F0F4F8' }}>
      <StatusBar barStyle="light-content" backgroundColor="#1A56DB" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Company Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Hero Card */}
        <View style={s.heroCard}>
          <View style={s.heroAccent} />
          <View style={s.avatarLarge}>
            <Text style={s.avatarText}>{company.name.charAt(0)}</Text>
          </View>
          <Text style={s.companyName}>{company.name}</Text>
          <View style={s.locationRow}>
            <Text style={s.locationIcon}>📍</Text>
            <Text style={s.location}>{company.location}</Text>
          </View>
          <View style={s.ratingRow}>
            <Text style={s.stars}>{renderStars(company.rating)}</Text>
            <View style={s.ratingBadge}>
              <Text style={s.ratingNum}>{company.rating}</Text>
            </View>
            <Text style={s.ratingCount}>({company.totalRatings} ratings)</Text>
          </View>
          <View style={s.estBadge}>
            <Text style={s.estText}>🏢 Established {company.established}</Text>
          </View>
        </View>

        {/* Quick Stats Row */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statIcon}>💰</Text>
            <Text style={s.statValue}>₹{company.ratePerKg}</Text>
            <Text style={s.statLabel}>per kg</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statIcon}>⭐</Text>
            <Text style={s.statValue}>{company.rating}</Text>
            <Text style={s.statLabel}>rating</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statIcon}>🛣️</Text>
            <Text style={s.statValue}>{company.routes.length}</Text>
            <Text style={s.statLabel}>routes</Text>
          </View>
        </View>

        {/* Info Card */}
        <View style={s.infoCard}>
          <Text style={s.sectionTitle}>Contact & Depot</Text>
          <View style={s.infoRow}>
            <View style={s.infoIconWrap}>
              <Text style={s.infoIcon}>📞</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.infoLabel}>Phone</Text>
              <Text style={s.infoValue}>{company.contactPhone}</Text>
            </View>
          </View>
          <View style={s.divider} />
          <View style={s.infoRow}>
            <View style={s.infoIconWrap}>
              <Text style={s.infoIcon}>🏭</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.infoLabel}>Depot Address</Text>
              <Text style={s.infoValue}>{company.depotAddress}</Text>
            </View>
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
              <View style={s.routeDot} />
              <Text style={s.routeText}>{route}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={s.bottomCta}>
        <View style={s.ctaInner}>
          <View>
            <Text style={s.ctaRate}>₹{company.ratePerKg}/kg</Text>
            <Text style={s.ctaSub}>Best price guaranteed</Text>
          </View>
          <TouchableOpacity style={s.bookBtn} onPress={onBookNow} activeOpacity={0.8}>
            <Text style={s.bookBtnText}>Book Now  →</Text>
          </TouchableOpacity>
        </View>
      </View>
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

  // Hero
  heroCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, alignItems: 'center',
    elevation: 4, shadowColor: '#1A3B6D', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12,
    overflow: 'hidden',
  },
  heroAccent: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 5,
    backgroundColor: '#1A56DB', borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  avatarLarge: {
    width: 76, height: 76, borderRadius: 22,
    backgroundColor: '#EBF0FF',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 14, marginTop: 4,
    borderWidth: 2, borderColor: '#C7D7FE',
  },
  avatarText: { fontSize: 34, fontWeight: '800', color: '#1A56DB' },
  companyName: { fontSize: 22, fontWeight: '800', color: '#0F172A', letterSpacing: 0.2 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  locationIcon: { fontSize: 13, marginRight: 4 },
  location: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  stars: { color: '#F59E0B', fontSize: 16 },
  ratingBadge: { backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 8 },
  ratingNum: { fontSize: 13, fontWeight: '800', color: '#B45309' },
  ratingCount: { fontSize: 13, color: '#94A3B8', marginLeft: 5 },
  estBadge: {
    marginTop: 12, backgroundColor: '#F8FAFC', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: '#E2E8F0',
  },
  estText: { fontSize: 12, color: '#64748B', fontWeight: '600' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  statCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, alignItems: 'center',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  statIcon: { fontSize: 22, marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  statLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 2 },

  // Info
  infoCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, marginTop: 14,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  infoIconWrap: {
    width: 38, height: 38, borderRadius: 10, backgroundColor: '#F0F9FF',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  infoIcon: { fontSize: 18 },
  infoLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#0F172A', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#F1F5F9' },

  // Sections
  sectionCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, marginTop: 14,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 12, letterSpacing: 0.1 },
  descText: { fontSize: 14, color: '#475569', lineHeight: 22 },
  routeItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  routeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1A56DB', marginRight: 12 },
  routeText: { fontSize: 14, color: '#334155', fontWeight: '500' },

  // Bottom CTA
  bottomCta: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16, paddingVertical: 14, paddingBottom: 20,
    borderTopWidth: 1, borderTopColor: '#E2E8F0',
    elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12,
  },
  ctaInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ctaRate: { fontSize: 20, fontWeight: '800', color: '#059669' },
  ctaSub: { fontSize: 11, color: '#94A3B8', fontWeight: '500', marginTop: 2 },
  bookBtn: {
    backgroundColor: '#1A56DB', borderRadius: 14,
    paddingHorizontal: 28, paddingVertical: 15,
    elevation: 4, shadowColor: '#1A56DB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
  bookBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
});

export default CompanyDetailScreen;
