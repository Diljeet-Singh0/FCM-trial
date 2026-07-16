export interface Coordinate {
  longitude: number;
  latitude: number;
}

export interface LocationData extends Coordinate {
  heading: number;
  speed: number;
  accuracy: number;
  timestamp: number;
}

export interface Maneuver {
  type: string;
  instruction: string;
  modifier?: string;
  bearing_after?: number;
  bearing_before?: number;
  location: [number, number];
}

export interface Step {
  maneuver: Maneuver;
  distance: number;
  duration: number;
  name: string;
  mode: string;
  geometry: {
    type: string;
    coordinates: [number, number][];
  };
}

export interface RouteLeg {
  steps: Step[];
  distance: number;
  duration: number;
  summary: string;
}

export interface Route {
  coordinates: Coordinate[];
  rawCoordinates: [number, number][];
  distance: number;
  duration: number;
  steps: Step[];
  legs: RouteLeg[];
  summary: string;
}

export interface SearchSuggestion {
  mapbox_id: string;
  name: string;
  full_address?: string;
  place_formatted?: string;
  address?: string;
  coordinate?: Coordinate;
}

export interface PlaceDetail {
  mapbox_id: string;
  name: string;
  full_address: string;
  coordinate: Coordinate;
}

export enum NavigationMode {
  IDLE = 'IDLE',
  SEARCHING = 'SEARCHING',
  ROUTE_PREVIEW = 'ROUTE_PREVIEW',
  NAVIGATING = 'NAVIGATING',
  ARRIVED = 'ARRIVED',
}

export enum RouteProfile {
  DRIVING = 'mapbox/driving',
  DRIVING_TRAFFIC = 'mapbox/driving-traffic',
  WALKING = 'mapbox/walking',
  CYCLING = 'mapbox/cycling',
}

export interface NavigationState {
  mode: NavigationMode;
  currentStepIndex: number;
  currentRouteIndex: number; // Index of driver's nearest point on route.coordinates
  distanceToNextManeuver: number;
  remainingDistance: number;
  remainingDuration: number;
  nextInstruction: string;
  nextManeuverType: string;
  nextManeuverModifier?: string;
  streetName: string;
  progress: number; // 0..1
  eta: Date;
  isOffRoute: boolean;
  isRerouting: boolean;
}

export interface TripStats {
  distanceTraveled: number;
  timeTaken: number;
  averageSpeed: number;
  startTime: Date;
  endTime: Date;
}

export type RootStackParamList = {
  Home: undefined;
  ActiveRequests: undefined;
  MapHome: {
    destinationAddress?: string;
    destinationCoords?: Coordinate;
  } | undefined;
  Navigation: {
    route: Route;
    sourceCoords: Coordinate;
    destinationCoords: Coordinate;
    sourceName: string;
    destinationName: string;
  };
};
