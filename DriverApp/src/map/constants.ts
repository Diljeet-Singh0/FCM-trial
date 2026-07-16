export { MAPBOX_ACCESS_TOKEN } from '../secrets';
export const MAPBOX_STYLE_URL = 'mapbox://styles/mapbox/navigation-night-v1';
export const MAPBOX_GEOCODING_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
export const MAPBOX_DIRECTIONS_URL = 'https://api.mapbox.com/directions/v5';
export const MAPBOX_SEARCH_URL = 'https://api.mapbox.com/search/searchbox/v1/suggest';
export const MAPBOX_RETRIEVE_URL = 'https://api.mapbox.com/search/searchbox/v1/retrieve';
export const MAPBOX_REVERSE_GEOCODE_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

// Route profiles
export const ROUTE_PROFILES = {
  DRIVING: 'mapbox/driving',
  DRIVING_TRAFFIC: 'mapbox/driving-traffic',
  WALKING: 'mapbox/walking',
  CYCLING: 'mapbox/cycling',
} as const;

// Navigation simulation speed (ms per coordinate point)
export const SIMULATION_INTERVAL = 400;

// Search debounce delay (ms)
export const SEARCH_DEBOUNCE_MS = 300;

// Distance threshold to snap to next step (km)
export const STEP_SNAP_THRESHOLD_KM = 0.03;

// Distance threshold to consider arrived (km)
export const ARRIVAL_THRESHOLD_KM = 0.05;

// Off-route detection & rerouting
export const OFF_ROUTE_THRESHOLD_KM = 0.05; // 50 meters — driver is considered off-route
export const REROUTE_COOLDOWN_MS = 10000; // 10 seconds between reroute attempts
export const OFF_ROUTE_CONFIRM_COUNT = 3; // consecutive off-route readings before triggering reroute

// Camera settings
export const CAMERA_ZOOM_NAVIGATING = 17;
export const CAMERA_ZOOM_PREVIEW = 14;
export const CAMERA_ZOOM_DEFAULT = 15;
export const CAMERA_PITCH_NAVIGATING = 60;
export const CAMERA_PITCH_DEFAULT = 0;
export const CAMERA_ANIMATION_DURATION = 500; // Reduced from 1000ms for snappier camera follow
