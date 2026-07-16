import {useState, useEffect, useRef, useCallback} from 'react';
import {PermissionsAndroid, Platform} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import {Coordinate, LocationData} from '../types';
import {haversineDistance} from '../utils/geo';

interface UseLocationResult {
  currentLocation: Coordinate | null;
  locationData: LocationData | null;
  heading: number;
  speed: number;
  locationError: string | null;
  hasPermission: boolean;
  refreshLocation: () => void;
  startWatching: () => void;
  stopWatching: () => void;
}

export const useLocation = (): UseLocationResult => {
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [heading, setHeading] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  // GPS jitter filtering refs
  const lastAcceptedRef = useRef<Coordinate | null>(null);
  const smoothedRef = useRef<Coordinate | null>(null);
  const GPS_ACCURACY_MAX = 30;
  const STATIONARY_SPEED_MAX = 0.5; // m/s
  const STATIONARY_DIST_MIN = 0.003; // km (~3m) — tighter threshold to reduce lag
  const SMOOTH_FACTOR = 0.75; // Higher = faster response to GPS (was 0.35)

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const fineLocation = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'This app needs your location for navigation.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );

        if (fineLocation === PermissionsAndroid.RESULTS.GRANTED) {
          setHasPermission(true);
          return true;
        } else {
          setLocationError('Location permission denied');
          return false;
        }
      } catch (err) {
        setLocationError('Permission request failed');
        return false;
      }
    }
    // iOS permissions are handled in Info.plist
    setHasPermission(true);
    return true;
  }, []);

  const getCurrentLocation = useCallback(() => {
    Geolocation.getCurrentPosition(
      position => {
        const coord: Coordinate = {
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
        };
        setCurrentLocation(coord);
        setHeading(position.coords.heading || 0);
        setSpeed(position.coords.speed || 0);
        setLocationData({
          ...coord,
          heading: position.coords.heading || 0,
          speed: position.coords.speed || 0,
          accuracy: position.coords.accuracy || 0,
          timestamp: position.timestamp,
        });
        setLocationError(null);
        lastAcceptedRef.current = coord;
        smoothedRef.current = coord;
      },
      error => {
        console.error('Location error:', error);
        setLocationError(error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      },
    );
  }, []);

  const startWatching = useCallback(() => {
    if (watchIdRef.current !== null) return;

    watchIdRef.current = Geolocation.watchPosition(
      position => {
        const rawCoord: Coordinate = {
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
        };
        const accuracy = position.coords.accuracy || 0;
        const spd = position.coords.speed || 0;

        // Filter 1: reject low-accuracy readings when we have a good fix
        if (accuracy > GPS_ACCURACY_MAX && lastAcceptedRef.current) {
          return;
        }

        // Filter 2: suppress micro-movements when stationary
        if (lastAcceptedRef.current && spd < STATIONARY_SPEED_MAX) {
          const movedKm = haversineDistance(lastAcceptedRef.current, rawCoord);
          if (movedKm < STATIONARY_DIST_MIN) {
            return;
          }
        }

        // Filter 3: exponential smoothing
        let smoothed: Coordinate;
        if (smoothedRef.current) {
          smoothed = {
            longitude:
              smoothedRef.current.longitude * (1 - SMOOTH_FACTOR) +
              rawCoord.longitude * SMOOTH_FACTOR,
            latitude:
              smoothedRef.current.latitude * (1 - SMOOTH_FACTOR) +
              rawCoord.latitude * SMOOTH_FACTOR,
          };
        } else {
          smoothed = rawCoord;
        }

        smoothedRef.current = smoothed;
        lastAcceptedRef.current = smoothed;

        setCurrentLocation(smoothed);
        setHeading(position.coords.heading || 0);
        setSpeed(spd);
        setLocationData({
          ...smoothed,
          heading: position.coords.heading || 0,
          speed: spd,
          accuracy,
          timestamp: position.timestamp,
        });
      },
      error => {
        console.error('Watch location error:', error);
        setLocationError(error.message);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 3, // Fire every 3m for snappy tracking (was 10m)
        interval: 1000, // Android: update every 1s (was 2s)
        fastestInterval: 500, // Android: fastest 500ms (was 1s)
      },
    );
  }, []);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const refreshLocation = useCallback(() => {
    getCurrentLocation();
  }, [getCurrentLocation]);

  useEffect(() => {
    const init = async () => {
      const granted = await requestPermission();
      if (granted) {
        getCurrentLocation();
        startWatching();
      }
    };
    init();

    return () => {
      stopWatching();
    };
  }, [requestPermission, getCurrentLocation, startWatching, stopWatching]);

  return {
    currentLocation,
    locationData,
    heading,
    speed,
    locationError,
    hasPermission,
    refreshLocation,
    startWatching,
    stopWatching,
  };
};
