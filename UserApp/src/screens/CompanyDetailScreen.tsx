import React, { useEffect, useState } from 'react';
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import type { Company } from './BrowseCompaniesScreen';
import { fetchCompanyImages } from '../api';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 32;

type Props = {
  company: Company & { searchedDestination?: string };
  onBack: () => void;
  onBookNow: () => void;
};

const CompanyDetailScreen = ({ company, onBack, onBookNow }: Props) => {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    const loadImages = async () => {
      // If company already has images populated, use them
      if (company.images && company.images.length > 0) {
        setImages(company.images);
        setLoading(false);
        return;
      }

      setLoading(true);
      const res = await fetchCompanyImages(company.id);
      if (res.success && res.images && res.images.length > 0) {
        setImages(res.images);
      }
      setLoading(false);
    };
    loadImages();
  }, [company.id, company.images]);

  const handleScroll = (event: any) => {
    const slide = Math.round(event.nativeEvent.contentOffset.x / CARD_WIDTH);
    if (slide !== activeImageIndex) {
      setActiveImageIndex(slide);
    }
  };

  const renderStars = (rating: number) => {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5 ? 1 : 0;
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - half);
  };

  // Determine if we have destination-specific search data
  const hasRouteSpecifics = company.priceMin !== undefined && company.priceMax !== undefined;
  const isExactCity = company.matchType === 'city';

  // Format pricing and delivery time
  const rateDisplay = hasRouteSpecifics
    ? (company.priceMin === company.priceMax ? `₹${company.priceMin}` : `₹${company.priceMin}-${company.priceMax}`)
    : `₹${company.rateDisplay || company.ratePerKg}`;

  const deliveryDisplay = (company.deliveryDaysMin !== undefined && company.deliveryDaysMin !== null && company.deliveryDaysMax !== undefined && company.deliveryDaysMax !== null)
    ? (company.deliveryDaysMin === company.deliveryDaysMax ? `${company.deliveryDaysMin} days` : `${company.deliveryDaysMin}-${company.deliveryDaysMax} days`)
    : company.deliveryTime || '2-5 days';

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Company Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Hero Card / Slider */}
        <View style={s.heroCard}>
          <View style={s.sliderContainer}>
            {loading ? (
              <View style={s.loaderContainer}>
                <ActivityIndicator size="small" color="#10B981" />
              </View>
            ) : (
              <>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={handleScroll}
                  scrollEventThrottle={16}
                  style={s.slider}
                >
                  {images.map((imgUrl, idx) => (
                    <Image
                      key={idx}
                      source={{ uri: imgUrl }}
                      style={s.sliderImage}
                      resizeMode="cover"
                    />
                  ))}
                </ScrollView>

                {/* Pagination Dots */}
                {images.length > 1 && (
                  <View style={s.pagination}>
                    {images.map((_, idx) => (
                      <View
                        key={idx}
                        style={[
                          s.paginationDot,
                          activeImageIndex === idx && s.paginationDotActive
                        ]}
                      />
                    ))}
                  </View>
                )}

                {/* Page Number Indicator */}
                {images.length > 0 && (
                  <View style={s.pageBadge}>
                    <Text style={s.pageBadgeText}>{activeImageIndex + 1}/{images.length}</Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Company details top */}
          <Text style={s.companyName}>{company.name}</Text>
          <View style={s.locationRow}>
            <Text style={s.locationIcon}>📍</Text>
            <Text style={s.location}>{company.location}</Text>
          </View>
          <View style={s.ratingRow}>
            <Text style={s.stars}>{renderStars(company.rating)}</Text>
            <View style={s.ratingBadge}>
              <Text style={s.ratingNum}>{company.rating.toFixed(1)}</Text>
            </View>
            <Text style={s.ratingCount}>({company.totalRatings} ratings)</Text>
          </View>

          {/* Searched Destination Notice */}
          {hasRouteSpecifics && company.searchedDestination && (
            <View style={[s.destinationAlert, isExactCity ? s.alertGreen : s.alertYellow]}>
              <Text style={[s.destinationAlertText, isExactCity ? s.textGreen : s.textYellow]}>
                {isExactCity
                  ? `🎯 Direct route coverage to "${company.searchedDestination}"`
                  : `🗺️ Covers "${company.searchedDestination}" via state-level transport`}
              </Text>
            </View>
          )}

          <View style={s.estBadge}>
            <Text style={s.estText}>🏢 Established {company.established}</Text>
          </View>
        </View>

        {/* Quick Stats Row */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statIcon}>💰</Text>
            <Text style={s.statValue}>{rateDisplay}</Text>
            <Text style={s.statLabel}>per kg</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statIcon}>⏱️</Text>
            <Text style={s.statValue}>{deliveryDisplay}</Text>
            <Text style={s.statLabel}>delivery time</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statIcon}>🛣️</Text>
            <Text style={s.statValue}>
              {company.routes_v2 && company.routes_v2.length > 0 ? company.routes_v2.length : company.routes.length}
            </Text>
            <Text style={s.statLabel}>regions</Text>
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

        {/* Routes Covered */}
        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>Routes Covered</Text>
          {company.routes_v2 && company.routes_v2.length > 0 ? (
            company.routes_v2.map((route: any, i: number) => {
              const isSearchedState = company.searchedDestination &&
                route.state.toLowerCase() === company.searchedDestination.toLowerCase();
              return (
                <View key={i} style={[s.stateRouteGroup, isSearchedState && s.stateRouteGroupHighlight]}>
                  <View style={s.stateHeader}>
                    <Text style={s.stateNameText}>📍 {route.state}</Text>
                    <Text style={s.statePricingText}>
                      ₹{route.price_min === route.price_max ? route.price_min : `${route.price_min}-${route.price_max}`}/kg
                    </Text>
                  </View>
                  <View style={s.citiesGrid}>
                    {route.cities && route.cities.map((city: any, ci: number) => {
                      const isSearchedCity = company.searchedDestination &&
                        city.name.toLowerCase() === company.searchedDestination.toLowerCase();
                      return (
                        <View key={ci} style={[s.cityChip, isSearchedCity && s.cityChipHighlight]}>
                          <Text style={[s.cityChipText, isSearchedCity && s.cityChipTextHighlight]}>
                            {city.name}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })
          ) : (
            // Fallback to legacy routes list
            company.routes.map((route, i) => (
              <View key={i} style={s.routeItem}>
                <View style={s.routeDot} />
                <Text style={s.routeText}>{route}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={s.bottomCta}>
        <View style={s.ctaInner}>
          <View>
            <Text style={s.ctaRate}>{rateDisplay}/kg</Text>
            <Text style={s.ctaSub}>Est. Delivery: {deliveryDisplay}</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 52,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 22,
    color: '#1A1A1A',
    fontWeight: '400',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    letterSpacing: 0.3,
  },

  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sliderContainer: {
    width: CARD_WIDTH,
    height: 195,
    marginTop: -16,
    marginBottom: 16,
    backgroundColor: '#EEF2F6',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 12,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slider: {
    flex: 1,
  },
  sliderImage: {
    width: CARD_WIDTH,
    height: 195,
  },
  pagination: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  paginationDotActive: {
    width: 16,
    backgroundColor: '#FFFFFF',
  },
  pageBadge: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  pageBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  companyName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: 0.2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  locationIcon: {
    fontSize: 13,
    marginRight: 4,
  },
  location: {
    fontSize: 14,
    color: '#6B6B6B',
    fontWeight: '500',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  stars: {
    color: '#F59E0B',
    fontSize: 16,
  },
  ratingBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 8,
  },
  ratingNum: {
    fontSize: 13,
    fontWeight: '800',
    color: '#B45309',
  },
  ratingCount: {
    fontSize: 13,
    color: '#6B6B6B',
    marginLeft: 5,
  },
  destinationAlert: {
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 1,
  },
  alertGreen: {
    backgroundColor: '#D1FAE5',
    borderColor: '#A7F3D0',
  },
  alertYellow: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  destinationAlertText: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  textGreen: {
    color: '#065F46',
  },
  textYellow: {
    color: '#92400E',
  },
  estBadge: {
    marginTop: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  estText: {
    fontSize: 12,
    color: '#6B6B6B',
    fontWeight: '600',
  },

  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B6B6B',
    fontWeight: '600',
    marginTop: 4,
  },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    marginTop: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  infoIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#E6F7F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  infoIcon: {
    fontSize: 18,
  },
  infoLabel: {
    fontSize: 11,
    color: '#6B6B6B',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
  },

  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    marginTop: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
    letterSpacing: 0.1,
  },
  descText: {
    fontSize: 14,
    color: '#1A1A1A',
    lineHeight: 22,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 12,
  },
  routeText: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '500',
  },

  // Structured route group
  stateRouteGroup: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  stateRouteGroupHighlight: {
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4',
  },
  stateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stateNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F2937',
  },
  statePricingText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#10B981',
  },
  citiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cityChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cityChipHighlight: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  cityChipText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '600',
  },
  cityChipTextHighlight: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  bottomCta: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ctaRate: {
    fontSize: 20,
    fontWeight: '800',
    color: '#10B981',
  },
  ctaSub: {
    fontSize: 11,
    color: '#6B6B6B',
    fontWeight: '500',
    marginTop: 2,
  },
  bookBtn: {
    backgroundColor: '#10B981',
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingVertical: 15,
    elevation: 4,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  bookBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

export default CompanyDetailScreen;
