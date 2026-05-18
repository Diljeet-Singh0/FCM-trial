import {useState, useRef, useCallback, useEffect} from 'react';
import {Platform, PermissionsAndroid} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import {Coordinate, Route, NavigationState, NavigationMode, TripStats} from '../types';
import {
  haversineDistance,
  calculateBearing,
  calculateRemainingDistance,
  calculateProgress,
  findNearestPointOnRoute,
} from '../utils/geo';
import {STEP_SNAP_THRESHOLD_KM, ARRIVAL_THRESHOLD_KM} from '../constants';

interface UseNavigationResult {
  navigationState: NavigationState;
  liveLocation: Coordinate | null;
  liveBearing: number;
  tripStats: TripStats | null;
  startNavigation: (route: Route) => void;
  stopNavigation: () => void;
  isActive: boolean;
}

const initialState: NavigationState = {
  mode: NavigationMode.IDLE,
  currentStepIndex: 0,
  distanceToNextManeuver: 0,
  remainingDistance: 0,
  remainingDuration: 0,
  nextInstruction: '',
  nextManeuverType: '',
  nextManeuverModifier: undefined,
  streetName: '',
  progress: 0,
  eta: new Date(),
};

export const useNavigation = (): UseNavigationResult => {
  const [navigationState, setNavigationState] = useState<NavigationState>(initialState);
  const [liveLocation, setLiveLocation] = useState<Coordinate | null>(null);
  const [liveBearing, setLiveBearing] = useState(0);
  const [tripStats, setTripStats] = useState<TripStats | null>(null);
  const [isActive, setIsActive] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const routeRef = useRef<Route | null>(null);
  const stepIndexRef = useRef(0);
  const startTimeRef = useRef<Date>(new Date());
  const isActiveRef = useRef(false);
  const lastLocationRef = useRef<Coordinate | null>(null);
  const distanceTraveledRef = useRef(0);

  const cleanup = useCallback(() => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const updateNavigationState = useCallback(
    (coord: Coordinate, route: Route) => {
      // Find nearest point on route to snap the user
      const {index: nearestIndex} = findNearestPointOnRoute(coord, route.coordinates);
      const totalPoints = route.coordinates.length;
      const progress = calculateProgress(nearestIndex, totalPoints);
      const remainingDist = calculateRemainingDistance(nearestIndex, route.coordinates);

      // Estimate remaining duration based on progress
      const remainingDuration = route.duration * (1 - progress);

      // Track distance traveled
      if (lastLocationRef.current) {
        const segmentDist = haversineDistance(lastLocationRef.current, coord) * 1000;
        if (segmentDist < 0.5) {
          // Ignore GPS jitter (less than 0.5km jump)
          distanceTraveledRef.current += segmentDist;
        }
      }
      lastLocationRef.current = coord;

      // Find current step based on proximity to maneuver points
      let currentStepIdx = stepIndexRef.current;
      for (let i = currentStepIdx; i < route.steps.length; i++) {
        const stepCoord: Coordinate = {
          longitude: route.steps[i].maneuver.location[0],
          latitude: route.steps[i].maneuver.location[1],
        };
        const dist = haversineDistance(coord, stepCoord);
        if (dist < STEP_SNAP_THRESHOLD_KM) {
          currentStepIdx = Math.min(i + 1, route.steps.length - 1);
          stepIndexRef.current = currentStepIdx;
          break;
        }
      }

      const currentStep = route.steps[currentStepIdx];
      const stepManeuverCoord: Coordinate = {
        longitude: currentStep.maneuver.location[0],
        latitude: currentStep.maneuver.location[1],
      };
      const distToManeuver = haversineDistance(coord, stepManeuverCoord) * 1000;

      // Calculate bearing from current position toward next route point
      if (nearestIndex < totalPoints - 1) {
        const nextRoutePoint = route.coordinates[Math.min(nearestIndex + 3, totalPoints - 1)];
        const bearing = calculateBearing(coord, nextRoutePoint);
        setLiveBearing(bearing);
      }

      // Check arrival
      const destCoord = route.coordinates[totalPoints - 1];
      const distToDestination = haversineDistance(coord, destCoord);

      if (distToDestination < ARRIVAL_THRESHOLD_KM) {
        const endTime = new Date();
        const timeTaken = (endTime.getTime() - startTimeRef.current.getTime()) / 1000;

        setTripStats({
          distanceTraveled: distanceTraveledRef.current,
          timeTaken,
          averageSpeed: distanceTraveledRef.current / timeTaken,
          startTime: startTimeRef.current,
          endTime,
        });

        setNavigationState(prev => ({
          ...prev,
          mode: NavigationMode.ARRIVED,
          progress: 1,
          remainingDistance: 0,
          remainingDuration: 0,
          nextInstruction: 'You have arrived at your destination',
          nextManeuverType: 'arrive',
        }));

        cleanup();
        setIsActive(false);
        isActiveRef.current = false;
        return;
      }

      setNavigationState({
        mode: NavigationMode.NAVIGATING,
        currentStepIndex: currentStepIdx,
        distanceToNextManeuver: distToManeuver,
        remainingDistance: remainingDist,
        remainingDuration,
        nextInstruction: currentStep.maneuver.instruction,
        nextManeuverType: currentStep.maneuver.type,
        nextManeuverModifier: currentStep.maneuver.modifier,
        streetName: currentStep.name || '',
        progress,
        eta: new Date(Date.now() + remainingDuration * 1000),
      });
    },
    [cleanup],
  );

  const startNavigation = useCallback(
    (route: Route) => {
      cleanup();
      routeRef.current = route;
      stepIndexRef.current = 0;
      startTimeRef.current = new Date();
      isActiveRef.current = true;
      lastLocationRef.current = null;
      distanceTraveledRef.current = 0;

      setIsActive(true);
      setTripStats(null);

      // Set initial state
      const firstStep = route.steps[0];
      setNavigationState({
        mode: NavigationMode.NAVIGATING,
        currentStepIndex: 0,
        distanceToNextManeuver: 0,
        remainingDistance: route.distance,
        remainingDuration: route.duration,
        nextInstruction: firstStep?.maneuver?.instruction || 'Starting navigation',
        nextManeuverType: firstStep?.maneuver?.type || 'depart',
        nextManeuverModifier: firstStep?.maneuver?.modifier,
        streetName: firstStep?.name || '',
        progress: 0,
        eta: new Date(Date.now() + route.duration * 1000),
      });

      // Start watching real GPS location
      watchIdRef.current = Geolocation.watchPosition(
        position => {
          if (!isActiveRef.current || !routeRef.current) return;

          const coord: Coordinate = {
            longitude: position.coords.longitude,
            latitude: position.coords.latitude,
          };

          setLiveLocation(coord);

          // Use device heading if available, otherwise calculate from route
          if (position.coords.heading && position.coords.heading >= 0) {
            setLiveBearing(position.coords.heading);
          }

          updateNavigationState(coord, routeRef.current);
        },
        error => {
          console.error('Navigation GPS error:', error);
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 5, // Update every 5 meters of movement
          interval: 1000, // Android: check every 1 second
          fastestInterval: 500, // Android: fastest update 500ms
          showsBackgroundLocationIndicator: true,
        },
      );
    },
    [cleanup, updateNavigationState],
  );

  const stopNavigation = useCallback(() => {
    cleanup();
    isActiveRef.current = false;
    setIsActive(false);
    setNavigationState(initialState);
    setLiveLocation(null);
    setLiveBearing(0);
  }, [cleanup]);

  return {
    navigationState,
    liveLocation,
    liveBearing,
    tripStats,
    startNavigation,
    stopNavigation,
    isActive,
  };
};
