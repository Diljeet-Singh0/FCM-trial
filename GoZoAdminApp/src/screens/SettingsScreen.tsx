import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, BORDER_RADIUS, SPACING } from '../theme';
import { triggerTestNotification, clearAllRides } from '../api';

interface SettingsScreenProps {
  onLogout: () => void;
}

export default function SettingsScreen({ onLogout }: SettingsScreenProps) {
  const [testingNotification, setTestingNotification] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  const handleTestNotification = async () => {
    setTestingNotification(true);
    try {
      const res = await triggerTestNotification();
      if (res.success) {
        Alert.alert(
          'Notification Sent',
          'A test push notification request has been sent to the server. You should receive a push notification shortly.'
        );
      } else {
        Alert.alert('Failure', res.error || 'Failed to trigger test notification');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Connection failed');
    } finally {
      setTestingNotification(false);
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      '⚠️ Delete ALL Rides',
      'This will permanently delete EVERY ride (normal and scheduled) from the database. This action CANNOT be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'I Understand, Delete All',
          style: 'destructive',
          onPress: () => {
            // Second confirmation
            Alert.alert(
              'Final Confirmation',
              'Are you absolutely sure? All ride records will be erased forever.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Everything',
                  style: 'destructive',
                  onPress: async () => {
                    setClearingAll(true);
                    try {
                      const res = await clearAllRides();
                      if (res.success) {
                        Alert.alert('Done', 'All rides have been permanently deleted.');
                      } else {
                        Alert.alert('Error', res.error || 'Failed to delete all rides.');
                      }
                    } catch (err: any) {
                      Alert.alert('Error', err.message || 'Connection failed.');
                    } finally {
                      setClearingAll(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out from the Admin App?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await AsyncStorage.removeItem('gozo_admin_token');
            await AsyncStorage.removeItem('gozo_admin_logged_in');
            onLogout();
          } catch (e) {
            Alert.alert('Error', 'Failed to log out');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Settings</Text>
      </View>

      <View style={styles.content}>
        {/* User Card */}
        <View style={styles.card}>
          <Text style={styles.label}>LOGGED IN AS</Text>
          <Text style={styles.roleText}>GoZo Operations Admin</Text>
          <Text style={styles.scopeText}>Full Read/Write Access</Text>
        </View>

        {/* Action Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>FCM Diagnostics</Text>
          <Text style={styles.descText}>
            Trigger a test push notification to verify that Firebase Cloud Messaging registration and delivery is working correctly for your device.
          </Text>
          <TouchableOpacity
            style={[styles.primaryBtn, testingNotification && styles.disabledBtn]}
            onPress={handleTestNotification}
            disabled={testingNotification}
          >
            {testingNotification ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.btnText}>Test Push Notification</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Info Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>App Info</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>App Name</Text>
            <Text style={styles.infoValue}>GoZo Admin</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Package Name</Text>
            <Text style={styles.infoValue}>com.gozo.admin</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>1.0.0 (Build 1)</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Framework</Text>
            <Text style={styles.infoValue}>React Native CLI</Text>
          </View>
        </View>

        {/* Danger Zone Card */}
        <View style={styles.card}>
          <Text style={[styles.sectionTitle, { color: COLORS.cancelled }]}>Danger Zone</Text>
          <Text style={styles.descText}>
            Permanently deletes ALL rides (both normal and scheduled) from the database. This action cannot be undone.
          </Text>
          <TouchableOpacity
            style={[styles.dangerBtn, clearingAll && styles.disabledBtn]}
            onPress={handleClearAll}
            disabled={clearingAll}
          >
            {clearingAll ? (
              <ActivityIndicator color={COLORS.cancelled} />
            ) : (
              <Text style={styles.dangerBtnText}>🗑  Delete All Rides</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.white,
  },
  content: {
    padding: SPACING.md,
    gap: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  roleText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
    marginTop: 4,
  },
  scopeText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  descText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: SPACING.md,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledBtn: {
    opacity: 0.7,
  },
  btnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
  },
  infoLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: 13,
    color: COLORS.white,
    fontWeight: '600',
  },
  dangerBtn: {
    backgroundColor: COLORS.cancelled + '12',
    borderColor: COLORS.cancelled,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dangerBtnText: {
    color: COLORS.cancelled,
    fontWeight: '800',
    fontSize: 15,
  },
  logoutBtn: {
    backgroundColor: COLORS.cancelled + '15',
    borderColor: COLORS.cancelled,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  logoutBtnText: {
    color: COLORS.cancelled,
    fontWeight: '800',
    fontSize: 15,
  },
});
