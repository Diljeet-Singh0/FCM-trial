import {
  MAPBOX_ACCESS_TOKEN,
  MAPBOX_GEOCODING_URL,
  MAPBOX_DIRECTIONS_URL,
  MAPBOX_SEARCH_URL,
  MAPBOX_RETRIEVE_URL,
  MAPBOX_REVERSE_GEOCODE_URL,
} from '../constants';
import {
  Coordinate,
  Route,
  SearchSuggestion,
  PlaceDetail,
  RouteProfile,
} from '../types';

/**
 * Search for places using Mapbox Search/Suggest API
 */
export const searchPlaces = async (
  query: string,
  proximity?: Coordinate,
  sessionToken?: string,
): Promise<SearchSuggestion[]> => {
  if (!query || query.trim().length < 2) return [];

  try {
    let url = `${MAPBOX_SEARCH_URL}?q=${encodeURIComponent(query)}&access_token=${MAPBOX_ACCESS_TOKEN}&language=en&limit=5&types=place,address,poi`;

    if (proximity) {
      url += `&proximity=${proximity.longitude},${proximity.latitude}`;
    }
    if (sessionToken) {
      url += `&session_token=${sessionToken}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.suggestions) {
      return data.suggestions.map((s: any) => ({
        mapbox_id: s.mapbox_id,
        name: s.name,
        full_address: s.full_address || s.place_formatted || '',
        place_formatted: s.place_formatted || '',
        address: s.address || '',
      }));
    }
    return [];
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
};

/**
 * Retrieve full place details including coordinates
 */
export const retrievePlace = async (
  mapboxId: string,
  sessionToken?: string,
): Promise<PlaceDetail | null> => {
  try {
    let url = `${MAPBOX_RETRIEVE_URL}/${mapboxId}?access_token=${MAPBOX_ACCESS_TOKEN}`;
    if (sessionToken) {
      url += `&session_token=${sessionToken}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const [longitude, latitude] = feature.geometry.coordinates;
      return {
        mapbox_id: mapboxId,
        name: feature.properties.name || '',
        full_address: feature.properties.full_address || feature.properties.place_formatted || '',
        coordinate: {longitude, latitude},
      };
    }
    return null;
  } catch (error) {
    console.error('Retrieve place error:', error);
    return null;
  }
};

/**
 * Forward geocode an address string to coordinates
 */
export const geocodeAddress = async (
  address: string,
): Promise<Coordinate | null> => {
  try {
    const response = await fetch(
      `${MAPBOX_GEOCODING_URL}/${encodeURIComponent(address)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=1`,
    );
    const data = await response.json();
    if (data.features && data.features.length > 0) {
      const [longitude, latitude] = data.features[0].center;
      return {longitude, latitude};
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};

/**
 * Reverse geocode coordinates to a place name
 */
export const reverseGeocode = async (
  coordinate: Coordinate,
): Promise<string> => {
  try {
    const response = await fetch(
      `${MAPBOX_REVERSE_GEOCODE_URL}/${coordinate.longitude},${coordinate.latitude}.json?access_token=${MAPBOX_ACCESS_TOKEN}&types=address,poi&limit=1`,
    );
    const data = await response.json();
    if (data.features && data.features.length > 0) {
      return data.features[0].place_name || 'Unknown Location';
    }
    return 'Unknown Location';
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return 'Unknown Location';
  }
};

/**
 * Fetch a route between source and destination
 */
export const fetchRoute = async (
  source: Coordinate,
  destination: Coordinate,
  profile: RouteProfile = RouteProfile.DRIVING_TRAFFIC,
): Promise<Route | null> => {
  try {
    const url = `${MAPBOX_DIRECTIONS_URL}/${profile}/${source.longitude},${source.latitude};${destination.longitude},${destination.latitude}?geometries=geojson&overview=full&steps=true&banner_instructions=true&voice_instructions=true&annotations=speed,duration,distance&access_token=${MAPBOX_ACCESS_TOKEN}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.routes && data.routes.length > 0) {
      const routeData = data.routes[0];
      const rawCoordinates: [number, number][] = routeData.geometry.coordinates;
      const coordinates = rawCoordinates.map(
        ([longitude, latitude]: [number, number]) => ({
          longitude,
          latitude,
        }),
      );

      return {
        coordinates,
        rawCoordinates,
        distance: routeData.distance,
        duration: routeData.duration,
        steps: routeData.legs[0].steps,
        legs: routeData.legs,
        summary: routeData.legs[0].summary || '',
      };
    }
    return null;
  } catch (error) {
    console.error('Directions error:', error);
    return null;
  }
};

/**
 * Fetch multiple alternative routes
 */
export const fetchAlternativeRoutes = async (
  source: Coordinate,
  destination: Coordinate,
  profile: RouteProfile = RouteProfile.DRIVING_TRAFFIC,
): Promise<Route[]> => {
  try {
    const url = `${MAPBOX_DIRECTIONS_URL}/${profile}/${source.longitude},${source.latitude};${destination.longitude},${destination.latitude}?geometries=geojson&overview=full&steps=true&alternatives=true&banner_instructions=true&access_token=${MAPBOX_ACCESS_TOKEN}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.routes && data.routes.length > 0) {
      return data.routes.map((routeData: any) => {
        const rawCoordinates: [number, number][] = routeData.geometry.coordinates;
        const coordinates = rawCoordinates.map(
          ([longitude, latitude]: [number, number]) => ({
            longitude,
            latitude,
          }),
        );

        return {
          coordinates,
          rawCoordinates,
          distance: routeData.distance,
          duration: routeData.duration,
          steps: routeData.legs[0].steps,
          legs: routeData.legs,
          summary: routeData.legs[0].summary || '',
        };
      });
    }
    return [];
  } catch (error) {
    console.error('Alternative routes error:', error);
    return [];
  }
};

/**
 * Generate a GeoJSON FeatureCollection from route coordinates
 */
export const routeToGeoJSON = (
  coordinates: [number, number][],
  properties: Record<string, any> = {},
): GeoJSON.FeatureCollection => {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties,
        geometry: {
          type: 'LineString',
          coordinates,
        },
      },
    ],
  };
};
