import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, StatusBar, Platform } from 'react-native';
import { fetchCertificate } from '../api';
import { GoodsCertificateCard } from './GoodsCertificateCard';

interface Props {
  tripId: string;
  onBack: () => void;
}

export const CertificateScreen = ({ tripId, onBack }: Props) => {
  const [certData, setCertData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCertificateData();
  }, [tripId]);

  const loadCertificateData = async () => {
    setLoading(true);
    setError(null);
    const res = await fetchCertificate(tripId);
    if (res.success && res.certificate) {
      setCertData(res.certificate);
    } else {
      setError(res.error || 'Failed to load certificate data.');
    }
    setLoading(false);
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Goods Certificate</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Main Content Area */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={s.loadingText}>Loading responsibility certificate...</Text>
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.errorIcon}>⚠️</Text>
          <Text style={s.errorTitle}>Certificate Not Found</Text>
          <Text style={s.errorSubtitle}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={loadCertificateData}>
            <Text style={s.retryBtnText}>Retry Loading</Text>
          </TouchableOpacity>
        </View>
      ) : certData ? (
        <ScrollView 
          contentContainerStyle={s.scrollContainer} 
          showsVerticalScrollIndicator={false}
        >
          <Text style={s.helperText}>
            This certificate confirms GoZo assumes custody and responsibility for your goods.
          </Text>
          <GoodsCertificateCard certificate={certData} />
        </ScrollView>
      ) : null}
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
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
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#6B6B6B',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
  helperText: {
    color: '#6B6B6B',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 16,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  retryBtn: {
    backgroundColor: '#10B981',
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 32,
    elevation: 2,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

