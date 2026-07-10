import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { COLORS } from '../theme';

import { navigationRef } from './navigationRef';

// Import Screens
import RidesScreen from '../screens/RidesScreen';
import RideDetailScreen from '../screens/RideDetailScreen';
import ScheduledRidesScreen from '../screens/ScheduledRidesScreen';
import ScheduledRideDetailScreen from '../screens/ScheduledRideDetailScreen';
import DriversScreen from '../screens/DriversScreen';
import DriverDetailScreen from '../screens/DriverDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Stacks for each tab to enable details pushing
function RidesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RidesHome" component={RidesScreen} />
      <Stack.Screen name="RideDetail" component={RideDetailScreen} />
    </Stack.Navigator>
  );
}

function ScheduledStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ScheduledHome" component={ScheduledRidesScreen} />
      <Stack.Screen name="ScheduledRideDetail" component={ScheduledRideDetailScreen} />
    </Stack.Navigator>
  );
}

function DriversStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DriversHome" component={DriversScreen} />
      <Stack.Screen name="DriverDetail" component={DriverDetailScreen} />
    </Stack.Navigator>
  );
}

interface AppNavigatorProps {
  onLogout: () => void;
}

export default function AppNavigator({ onLogout }: AppNavigatorProps) {
  // Wrapped Settings screen inside a stack
  const SettingsStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SettingsHome">
        {(props) => <SettingsScreen {...props} onLogout={onLogout} />}
      </Stack.Screen>
    </Stack.Navigator>
  );

  return (
    <NavigationContainer ref={navigationRef}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.textSecondary,
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarIcon: ({ focused }) => {
            let label = '';
            switch (route.name) {
              case 'Rides':
                label = '🚗';
                break;
              case 'Scheduled':
                label = '📅';
                break;
              case 'Drivers':
                label = '👤';
                break;
              case 'Settings':
                label = '⚙️';
                break;
            }
            return (
              <View style={styles.iconContainer}>
                <Text style={[styles.iconText, focused && styles.iconActive]}>
                  {label}
                </Text>
              </View>
            );
          },
        })}
      >
        <Tab.Screen name="Rides" component={RidesStack} />
        <Tab.Screen name="Scheduled" component={ScheduledStack} />
        <Tab.Screen name="Drivers" component={DriversStack} />
        <Tab.Screen name="Settings" component={SettingsStack} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    height: 60,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 20,
    opacity: 0.6,
  },
  iconActive: {
    opacity: 1,
  },
});
