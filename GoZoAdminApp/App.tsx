import React, { useEffect, useState } from 'react';
import { StyleSheet, View, LogBox, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';

import LoginScreen from './src/screens/LoginScreen';
import AppNavigator from './src/navigation/AppNavigator';
import { registerAdminFcmToken } from './src/api';
import { navigate } from './src/navigation/navigationRef';
import { COLORS } from './src/theme';

LogBox.ignoreLogs(['Sending `onAnimatedValueUpdate`']);

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  // 1. Check persistent login state
  useEffect(() => {
    const checkLoginState = async () => {
      try {
        const loggedIn = await AsyncStorage.getItem('gozo_admin_logged_in');
        const token = await AsyncStorage.getItem('gozo_admin_token');
        if (loggedIn === 'true' && token) {
          setIsLoggedIn(true);
        } else {
          setIsLoggedIn(false);
        }
      } catch (e) {
        setIsLoggedIn(false);
      }
    };
    checkLoginState();
  }, []);

  // 2. FCM & Notifee Setup
  useEffect(() => {
    if (isLoggedIn !== true) return;

    const setupNotifications = async () => {
      try {
        // Request FCM Permissions
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (enabled) {
          console.log('FCM Permission granted');
          
          // Get Token and register it
          const token = await messaging().getToken();
          if (token) {
            console.log('FCM Token:', token);
            await registerAdminFcmToken(token);
          }

          // Listen to token refreshes
          messaging().onTokenRefresh(async (newToken) => {
            console.log('FCM Token Refreshed:', newToken);
            await registerAdminFcmToken(newToken);
          });
        }
      } catch (err) {
        console.warn('Error setting up notifications', err);
      }
    };

    setupNotifications();
  }, [isLoggedIn]);

  // 3. Foreground Notification Handler & Deep Linking Setup
  useEffect(() => {
    if (isLoggedIn !== true) return;

    // Create Notifee Channel for Android
    const createNotifeeChannel = async () => {
      await notifee.createChannel({
        id: 'gozo_admin_alerts',
        name: 'GoZo Admin Alerts',
        importance: AndroidImportance.HIGH,
      });
    };
    createNotifeeChannel();

    // Listen to Firebase foreground messages
    const unsubscribeMessaging = messaging().onMessage(async (remoteMessage) => {
      console.log('Foreground FCM Message received:', remoteMessage);

      // Display the banner using Notifee
      await notifee.displayNotification({
        title: remoteMessage.notification?.title || 'GoZo Operations Alert',
        body: remoteMessage.notification?.body || 'New operational update',
        android: {
          channelId: 'gozo_admin_alerts',
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default',
          },
        },
        data: remoteMessage.data,
      });
    });

    // Handle deep linking from Notifee Foreground Taps
    const unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS) {
        const data = detail.notification?.data;
        if (data) {
          handleNotificationTap(data);
        }
      }
    });

    // Check if app was opened via a notification tap from a completely quit state
    notifee.getInitialNotification().then((initialNotification) => {
      if (initialNotification) {
        console.log('App opened from notification in quit state:', initialNotification);
        const data = initialNotification.notification.data;
        if (data) {
          // Delay briefly to allow navigation container to mount
          setTimeout(() => {
            handleNotificationTap(data);
          }, 1500);
        }
      }
    });

    return () => {
      unsubscribeMessaging();
      unsubscribeNotifee();
    };
  }, [isLoggedIn]);

  // 4. Core navigation router based on push data
  const handleNotificationTap = (data: any) => {
    console.log('Handling Notification Tap:', data);
    const { type, requestId, rideId } = data;

    if (type === 'ride_created' || type === 'ride_unassigned') {
      const targetId = requestId || data.request_id;
      if (targetId) {
        navigate('Rides', {
          screen: 'RideDetail',
          params: { requestId: targetId },
        });
      }
    } else if (type === 'scheduled_ride_created') {
      const targetId = rideId || data.ride_id;
      if (targetId) {
        navigate('Scheduled', {
          screen: 'ScheduledRideDetail',
          params: { rideId: targetId },
        });
      }
    }
  };

  if (isLoggedIn === null) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider style={styles.container}>
      {isLoggedIn ? (
        <AppNavigator onLogout={() => setIsLoggedIn(false)} />
      ) : (
        <LoginScreen onLoginSuccess={() => setIsLoggedIn(true)} />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  splash: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
