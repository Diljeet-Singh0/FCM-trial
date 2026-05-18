import {useState, useEffect, useRef, useCallback} from 'react';
import {PermissionsAndroid, Platform} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import {Coordinate, LocationData} from '../types';

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
      },
      error => {
        console.error('Watch location error:', error);
        setLocationError(error.message);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 5,
        interval: 1000,
        fastestInterval: 500,
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
      }
    };
    init();

    return () => {
      stopWatching();
    };
  }, [requestPermission, getCurrentLocation, stopWatching]);

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
