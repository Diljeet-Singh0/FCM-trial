import {useState, useCallback} from 'react';
import {Coordinate, Route, RouteProfile} from '../types';
import {fetchRoute, fetchAlternativeRoutes} from '../utils/mapbox';

interface UseRouteResult {
  route: Route | null;
  alternativeRoutes: Route[];
  selectedRouteIndex: number;
  loading: boolean;
  error: string | null;
  getRoute: (source: Coordinate, destination: Coordinate, profile?: RouteProfile) => Promise<Route | null>;
  getAlternatives: (source: Coordinate, destination: Coordinate, profile?: RouteProfile) => Promise<void>;
  selectRoute: (index: number) => void;
  clearRoute: () => void;
}

export const useRoute = (): UseRouteResult => {
  const [route, setRoute] = useState<Route | null>(null);
  const [alternativeRoutes, setAlternativeRoutes] = useState<Route[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getRoute = useCallback(
    async (
      source: Coordinate,
      destination: Coordinate,
      profile: RouteProfile = RouteProfile.DRIVING_TRAFFIC,
    ): Promise<Route | null> => {
      setLoading(true);
      setError(null);

      try {
        const fetchedRoute = await fetchRoute(source, destination, profile);
        if (fetchedRoute) {
          setRoute(fetchedRoute);
          setSelectedRouteIndex(0);
          setLoading(false);
          return fetchedRoute;
        } else {
          setError('No route found');
          setLoading(false);
          return null;
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch route');
        setLoading(false);
        return null;
      }
    },
    [],
  );

  const getAlternatives = useCallback(
    async (
      source: Coordinate,
      destination: Coordinate,
      profile: RouteProfile = RouteProfile.DRIVING_TRAFFIC,
    ): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const routes = await fetchAlternativeRoutes(source, destination, profile);
        if (routes.length > 0) {
          setRoute(routes[0]);
          setAlternativeRoutes(routes);
          setSelectedRouteIndex(0);
        } else {
          setError('No routes found');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch routes');
      }

      setLoading(false);
    },
    [],
  );

  const selectRoute = useCallback(
    (index: number) => {
      if (index >= 0 && index < alternativeRoutes.length) {
        setRoute(alternativeRoutes[index]);
        setSelectedRouteIndex(index);
      }
    },
    [alternativeRoutes],
  );

  const clearRoute = useCallback(() => {
    setRoute(null);
    setAlternativeRoutes([]);
    setSelectedRouteIndex(0);
    setError(null);
  }, []);

  return {
    route,
    alternativeRoutes,
    selectedRouteIndex,
    loading,
    error,
    getRoute,
    getAlternatives,
    selectRoute,
    clearRoute,
  };
};
