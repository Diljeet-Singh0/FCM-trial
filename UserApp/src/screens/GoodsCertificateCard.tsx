import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import ViewShot from 'react-native-view-shot';
import Share from 'react-native-share';

export interface CertificateData {
  id: string;
  certificate_id: string;
  trip_id: string;
  factory_name: string;
  factory_owner_name: string;
  driver_name: string;
  vehicle_number: string;
  goods_description: string;
  pickup_location: string;
  drop_location: string;
  pickup_timestamp: string;
}

interface Props {
  certificate: CertificateData;
}

export const GoodsCertificateCard = ({ certificate }: Props) => {
  const viewShotRef = useRef<any>(null);
  const [sharing, setSharing] = useState(false);

  const formatDateTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata',
      }) + ' (IST)';
    } catch (e) {
      return isoString;
    }
  };

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      if (!viewShotRef.current?.capture) {
        throw new Error('Capture function not available');
      }
      const uri = await viewShotRef.current.capture();
      await Share.open({
        url: uri,
        type: 'image/png',
        title: 'Share Goods Responsibility Certificate',
        subject: `Goods Responsibility Certificate ${certificate.certificate_id}`,
        message: `Goods Responsibility Certificate for GoZo Trip ${certificate.certificate_id}`,
      });
    } catch (error: any) {
      if (error && error.message && error.message.includes('User cancelled')) {
        // User cancelled sharing, ignore
      } else {
        console.warn('Share error:', error);
        Alert.alert('Share Failed', 'Unable to share certificate image. Please try again.');
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={s.container}>
      {/* ViewShot captures this card container */}
      <ViewShot
        ref={viewShotRef}
        options={{ format: 'png', quality: 0.95 }}
        style={s.cardWrapper}
      >
        <View style={s.card}>
          {/* Top Banner Accent */}
          <View style={s.headerAccent} />

          {/* Header */}
          <View style={s.header}>
            <View style={s.logoContainer}>
              <Text style={s.logoText}>Go<Text style={s.logoHighlight}>Zo</Text></Text>
              <Text style={s.logoSub}>LOGISTICS</Text>
            </View>
            <View style={s.badgeContainer}>
              <View style={s.badge}>
                <Text style={s.badgeText}>VERIFIED</Text>
              </View>
            </View>
          </View>

          {/* Certificate Title */}
          <Text style={s.title}>GOODS RESPONSIBILITY CERTIFICATE</Text>
          <Text style={s.subtitle}>ISSUED BY GOZO LOGISTICS PRIVATE LIMITED</Text>

          <View style={s.divider} />

          {/* Certificate ID & Timestamp */}
          <View style={s.metaRow}>
            <View style={s.metaCol}>
              <Text style={s.metaLabel}>CERTIFICATE ID</Text>
              <Text style={s.metaValId}>{certificate.certificate_id}</Text>
            </View>
            <View style={[s.metaCol, { alignItems: 'flex-end' }]}>
              <Text style={s.metaLabel}>PICKUP TIMESTAMP (IST)</Text>
              <Text style={s.metaVal}>{formatDateTime(certificate.pickup_timestamp)}</Text>
            </View>
          </View>

          {/* Main Content Grid */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>SHIPMENT DETAILS</Text>
            
            <View style={s.gridRow}>
              <View style={s.gridCol}>
                <Text style={s.gridLabel}>FACTORY OWNER</Text>
                <Text style={s.gridVal}>{certificate.factory_owner_name}</Text>
              </View>
              <View style={s.gridCol}>
                <Text style={s.gridLabel}>FACTORY NAME</Text>
                <Text style={s.gridVal}>{certificate.factory_name}</Text>
              </View>
            </View>

            <View style={s.gridRow}>
              <View style={s.gridCol}>
                <Text style={s.gridLabel}>ASSIGNED DRIVER</Text>
                <Text style={s.gridVal}>{certificate.driver_name}</Text>
              </View>
              <View style={s.gridCol}>
                <Text style={s.gridLabel}>VEHICLE NUMBER</Text>
                <Text style={s.gridVal}>{certificate.vehicle_number}</Text>
              </View>
            </View>

            <View style={s.singleRow}>
              <Text style={s.gridLabel}>GOODS DESCRIPTION</Text>
              <Text style={s.gridValGoods}>{certificate.goods_description}</Text>
            </View>
          </View>

          {/* Route Section */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>TRANSIT ROUTE</Text>
            <View style={s.routeContainer}>
              <View style={s.routeLineWrapper}>
                <View style={s.routeDotGreen} />
                <View style={s.routeLine} />
                <View style={s.routeDotBlue} />
              </View>
              <View style={s.routeTexts}>
                <View>
                  <Text style={s.routeLabel}>PICKUP ADDRESS (FACTORY)</Text>
                  <Text style={s.routeVal} numberOfLines={2}>{certificate.pickup_location}</Text>
                </View>
                <View style={{ marginTop: 12 }}>
                  <Text style={s.routeLabel}>DROP ADDRESS (TRANSPORT COMPANY)</Text>
                  <Text style={s.routeVal} numberOfLines={2}>{certificate.drop_location}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Legal / Responsibility Statement */}
          <View style={s.statementCard}>
            <Text style={s.statementText}>
              GoZo Logistics hereby certifies that we assume full operational and legal responsibility 
              for the described goods starting from the timestamp of pickup until their successful 
              delivery and handover to the transport company at the designated drop address. 
              This document serves as formal confirmation of custody.
            </Text>
          </View>

          {/* Footer branding */}
          <View style={s.cardFooter}>
            <Text style={s.footerLeft}>GoZo Trust & Safety Division</Text>
            <Text style={s.footerRight}>No signature required • Digitally generated</Text>
          </View>
        </View>
      </ViewShot>

      {/* Action Button */}
      <TouchableOpacity
        style={s.shareButton}
        onPress={handleShare}
        disabled={sharing}
        activeOpacity={0.85}
      >
        {sharing ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <View style={s.btnContent}>
            <Text style={s.btnIcon}>📤</Text>
            <Text style={s.btnText}>Share Certificate (PNG)</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    marginVertical: 10,
    width: '100%',
  },
  cardWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
  },
  headerAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: '#10B981',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 14,
  },
  logoContainer: {
    flexDirection: 'column',
  },
  logoText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  logoHighlight: {
    color: '#10B981',
  },
  logoSub: {
    fontSize: 8,
    fontWeight: '700',
    color: '#6B6B6B',
    letterSpacing: 2,
    marginTop: -2,
  },
  badgeContainer: {
    flexDirection: 'row',
  },
  badge: {
    backgroundColor: '#E6F7F0',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 9,
    fontWeight: '600',
    color: '#6B6B6B',
    textAlign: 'center',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  divider: {
    height: 1.5,
    backgroundColor: '#E2E8F0',
    marginVertical: 14,
    borderStyle: 'dashed',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#6B6B6B',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  metaValId: {
    fontSize: 13,
    fontWeight: '800',
    color: '#10B981',
  },
  metaVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  section: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#6B6B6B',
    letterSpacing: 1,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 4,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  gridCol: {
    flex: 1,
    marginRight: 8,
  },
  gridLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#6B6B6B',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  gridVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  singleRow: {
    marginTop: 2,
  },
  gridValGoods: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  routeContainer: {
    flexDirection: 'row',
  },
  routeLineWrapper: {
    alignItems: 'center',
    marginRight: 10,
    paddingTop: 4,
  },
  routeDotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  routeDotBlue: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E53935',
  },
  routeLine: {
    width: 1.5,
    height: 32,
    backgroundColor: '#E5E5E5',
    marginVertical: 4,
  },
  routeTexts: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 7.5,
    fontWeight: '700',
    color: '#6B6B6B',
    letterSpacing: 0.3,
  },
  routeVal: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 1,
  },
  statementCard: {
    backgroundColor: '#E6F7F0',
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  statementText: {
    fontSize: 10,
    lineHeight: 14,
    color: '#0F5132',
    fontWeight: '500',
    textAlign: 'justify',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  footerLeft: {
    fontSize: 8,
    fontWeight: '700',
    color: '#6B6B6B',
  },
  footerRight: {
    fontSize: 8,
    fontWeight: '500',
    color: '#6B6B6B',
  },
  shareButton: {
    marginTop: 12,
    backgroundColor: '#10B981',
    borderRadius: 28,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

