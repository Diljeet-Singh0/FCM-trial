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
import {fetchRoute} from '../utils/mapbox';
import {
  STEP_SNAP_THRESHOLD_KM,
  ARRIVAL_THRESHOLD_KM,
  OFF_ROUTE_THRESHOLD_KM,
  REROUTE_COOLDOWN_MS,
  OFF_ROUTE_CONFIRM_COUNT,
} from '../constants';

interface UseNavigationResult {
  navigationState: NavigationState;
  liveLocation: Coordinate | null;
  liveBearing: number;
  tripStats: TripStats | null;
  activeRoute: Route | null;
  startNavigation: (route: Route, destination: Coordinate) => void;
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
  isOffRoute: false,
  isRerouting: false,
};

export const useNavigation = (): UseNavigationResult => {
  const [navigationState, setNavigationState] = useState<NavigationState>(initialState);
  const [liveLocation, setLiveLocation] = useState<Coordinate | null>(null);
  const [liveBearing, setLiveBearing] = useState(0);
  const [tripStats, setTripStats] = useState<TripStats | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [activeRoute, setActiveRoute] = useState<Route | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const routeRef = useRef<Route | null>(null);
  const destinationRef = useRef<Coordinate | null>(null);
  const stepIndexRef = useRef(0);
  const startTimeRef = useRef<Date>(new Date());
  const isActiveRef = useRef(false);
  const lastLocationRef = useRef<Coordinate | null>(null);
  const distanceTraveledRef = useRef(0);

  // Off-route detection refs
  const offRouteCountRef = useRef(0);
  const lastRerouteTimeRef = useRef(0);
  const isReroutingRef = useRef(false);

  // GPS jitter filtering refs
  const lastAcceptedLocationRef = useRef<Coordinate | null>(null);
  const smoothedLocationRef = useRef<Coordinate | null>(null);
  const GPS_ACCURACY_THRESHOLD = 30; // Ignore readings with accuracy worse than 30m
  const STATIONARY_SPEED_THRESHOLD = 0.5; // m/s — below this, consider stationary
  const STATIONARY_DISTANCE_THRESHOLD = 0.008; // 8 meters in km — ignore micro-movements when stationary
  const SMOOTHING_FACTOR = 0.35; // Exponential smoothing: 0 = full old, 1 = full new

  const cleanup = useCallback(() => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // ─── Reroute from current position to destination ───
  const performReroute = useCallback(
    async (currentCoord: Coordinate) => {
      if (isReroutingRef.current || !destinationRef.current || !isActiveRef.current) {
        return;
      }

      // Enforce cooldown
      const now = Date.now();
      if (now - lastRerouteTimeRef.current < REROUTE_COOLDOWN_MS) {
        return;
      }

      isReroutingRef.current = true;
      lastRerouteTimeRef.current = now;

      setNavigationState(prev => ({
        ...prev,
        isRerouting: true,
        isOffRoute: true,
        nextInstruction: 'Rerouting...',
      }));

      try {
        const newRoute = await fetchRoute(currentCoord, destinationRef.current);

        if (newRoute && isActiveRef.current) {
          // Update refs and state with the new route
          routeRef.current = newRoute;
          stepIndexRef.current = 0;
          offRouteCountRef.current = 0;

          setActiveRoute(newRoute);

          // Set fresh navigation state from the new route
          const firstStep = newRoute.steps[0];
          setNavigationState({
            mode: NavigationMode.NAVIGATING,
            currentStepIndex: 0,
            distanceToNextManeuver: 0,
            remainingDistance: newRoute.distance,
            remainingDuration: newRoute.duration,
            nextInstruction: firstStep?.maneuver?.instruction || 'Continue on the route',
            nextManeuverType: firstStep?.maneuver?.type || 'depart',
            nextManeuverModifier: firstStep?.maneuver?.modifier,
            streetName: firstStep?.name || '',
            progress: 0,
            eta: new Date(Date.now() + newRoute.duration * 1000),
            isOffRoute: false,
            isRerouting: false,
          });
        }
      } catch (error) {
        console.error('Reroute failed:', error);
        // Reset rerouting state so we can try again
        setNavigationState(prev => ({
          ...prev,
          isRerouting: false,
        }));
      } finally {
        isReroutingRef.current = false;
      }
    },
    [],
  );

  const updateNavigationState = useCallback(
    (coord: Coordinate, route: Route) => {
      // Find nearest point on route to snap the user
      const {index: nearestIndex, distance: distFromRoute} = findNearestPointOnRoute(coord, route.coordinates);
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

      // ─── Off-Route Detection ───
      if (distFromRoute > OFF_ROUTE_THRESHOLD_KM) {
        offRouteCountRef.current += 1;

        if (offRouteCountRef.current >= OFF_ROUTE_CONFIRM_COUNT && !isReroutingRef.current) {
          // Driver is confirmed off-route — trigger reroute
          performReroute(coord);
          return; // Don't update state further — reroute will set fresh state
        }

        // Show off-route warning while accumulating confirmations
        setNavigationState(prev => ({
          ...prev,
          isOffRoute: true,
        }));
      } else {
        // Back on route — reset counter
        offRouteCountRef.current = 0;
      }

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
          isOffRoute: false,
          isRerouting: false,
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
        isOffRoute: distFromRoute > OFF_ROUTE_THRESHOLD_KM,
        isRerouting: false,
      });
    },
    [cleanup, performReroute],
  );

  const startNavigation = useCallback(
    (route: Route, destination: Coordinate) => {
      cleanup();
      routeRef.current = route;
      destinationRef.current = destination;
      stepIndexRef.current = 0;
      startTimeRef.current = new Date();
      isActiveRef.current = true;
      lastLocationRef.current = null;
      distanceTraveledRef.current = 0;
      offRouteCountRef.current = 0;
      lastRerouteTimeRef.current = 0;
      isReroutingRef.current = false;
      lastAcceptedLocationRef.current = null;
      smoothedLocationRef.current = null;

      setIsActive(true);
      setTripStats(null);
      setActiveRoute(route);

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
        isOffRoute: false,
        isRerouting: false,
      });

      // Start watching real GPS location
      watchIdRef.current = Geolocation.watchPosition(
        position => {
          if (!isActiveRef.current || !routeRef.current) return;

          const rawCoord: Coordinate = {
            longitude: position.coords.longitude,
            latitude: position.coords.latitude,
          };
          const accuracy = position.coords.accuracy || 0;
          const speed = position.coords.speed || 0;

          // ─── Filter 1: Reject low-accuracy readings ───
          if (accuracy > GPS_ACCURACY_THRESHOLD && lastAcceptedLocationRef.current) {
            // Keep the last known good location instead
            return;
          }

          // ─── Filter 2: Suppress micro-movements when stationary ───
          if (lastAcceptedLocationRef.current && speed < STATIONARY_SPEED_THRESHOLD) {
            const movedDist = haversineDistance(lastAcceptedLocationRef.current, rawCoord);
            if (movedDist < STATIONARY_DISTANCE_THRESHOLD) {
              // Driver hasn't really moved — skip this update
              return;
            }
          }

          // ─── Filter 3: Exponential smoothing ───
          let smoothed: Coordinate;
          if (smoothedLocationRef.current) {
            smoothed = {
              longitude:
                smoothedLocationRef.current.longitude * (1 - SMOOTHING_FACTOR) +
                rawCoord.longitude * SMOOTHING_FACTOR,
              latitude:
                smoothedLocationRef.current.latitude * (1 - SMOOTHING_FACTOR) +
                rawCoord.latitude * SMOOTHING_FACTOR,
            };
          } else {
            smoothed = rawCoord;
          }

          smoothedLocationRef.current = smoothed;
          lastAcceptedLocationRef.current = smoothed;

          setLiveLocation(smoothed);

          // Use device heading if available, otherwise calculate from route
          if (position.coords.heading && position.coords.heading >= 0) {
            setLiveBearing(position.coords.heading);
          }

          updateNavigationState(smoothed, routeRef.current);
        },
        error => {
          console.error('Navigation GPS error:', error);
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 10, // Only fire when moved 10m (was 5m, too sensitive)
          interval: 2000, // Android: check every 2 seconds (was 1s)
          fastestInterval: 1000, // Android: fastest update 1s (was 500ms)
          showsBackgroundLocationIndicator: true,
        },
      );
    },
    [cleanup, updateNavigationState],
  );

  const stopNavigation = useCallback(() => {
    cleanup();
    isActiveRef.current = false;
    isReroutingRef.current = false;
    offRouteCountRef.current = 0;
    setIsActive(false);
    setNavigationState(initialState);
    setLiveLocation(null);
    setLiveBearing(0);
    setActiveRoute(null);
  }, [cleanup]);

  return {
    navigationState,
    liveLocation,
    liveBearing,
    tripStats,
    activeRoute,
    startNavigation,
    stopNavigation,
    isActive,
  };
};
