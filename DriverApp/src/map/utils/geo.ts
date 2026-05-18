import {Coordinate} from '../types';

/**
 * Calculate the Haversine distance between two coordinates in kilometers
 */
export const haversineDistance = (
  coord1: Coordinate,
  coord2: Coordinate,
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(coord2.latitude - coord1.latitude);
  const dLon = toRad(coord2.longitude - coord1.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.latitude)) *
      Math.cos(toRad(coord2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Convert degrees to radians
 */
export const toRad = (deg: number): number => {
  return deg * (Math.PI / 180);
};

/**
 * Convert radians to degrees
 */
export const toDeg = (rad: number): number => {
  return rad * (180 / Math.PI);
};

/**
 * Calculate the bearing (heading) from coord1 to coord2 in degrees (0-360)
 */
export const calculateBearing = (
  coord1: Coordinate,
  coord2: Coordinate,
): number => {
  const dLon = toRad(coord2.longitude - coord1.longitude);
  const lat1 = toRad(coord1.latitude);
  const lat2 = toRad(coord2.latitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
};

/**
 * Format distance in meters to human-readable string
 */
export const formatDistance = (meters: number): string => {
  if (meters < 100) {
    return `${Math.round(meters)} m`;
  }
  if (meters < 1000) {
    return `${Math.round(meters / 10) * 10} m`;
  }
  if (meters < 10000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters / 1000)} km`;
};

/**
 * Format duration in seconds to human-readable string
 */
export const formatDuration = (seconds: number): string => {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) {
    return '< 1 min';
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${remainingMinutes} min`;
};

/**
 * Calculate ETA as a Date from remaining duration in seconds
 */
export const calculateETA = (remainingSeconds: number): Date => {
  return new Date(Date.now() + remainingSeconds * 1000);
};

/**
 * Format ETA time
 */
export const formatETA = (date: Date): string => {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');
  return `${displayHours}:${displayMinutes} ${ampm}`;
};

/**
 * Find the index of the nearest point on a route to a given coordinate
 */
export const findNearestPointOnRoute = (
  location: Coordinate,
  routeCoordinates: Coordinate[],
): {index: number; distance: number} => {
  let minDistance = Infinity;
  let nearestIndex = 0;

  for (let i = 0; i < routeCoordinates.length; i++) {
    const dist = haversineDistance(location, routeCoordinates[i]);
    if (dist < minDistance) {
      minDistance = dist;
      nearestIndex = i;
    }
  }

  return {index: nearestIndex, distance: minDistance};
};

/**
 * Calculate the progress along the route (0..1)
 */
export const calculateProgress = (
  currentIndex: number,
  totalPoints: number,
): number => {
  if (totalPoints <= 1) return 0;
  return Math.min(currentIndex / (totalPoints - 1), 1);
};

/**
 * Calculate the remaining distance from a point on the route to the end
 */
export const calculateRemainingDistance = (
  fromIndex: number,
  routeCoordinates: Coordinate[],
): number => {
  let distance = 0;
  for (let i = fromIndex; i < routeCoordinates.length - 1; i++) {
    distance += haversineDistance(routeCoordinates[i], routeCoordinates[i + 1]);
  }
  return distance * 1000; // Convert to meters
};

/**
 * Format speed from m/s to km/h
 */
export const formatSpeed = (metersPerSecond: number): string => {
  const kmh = metersPerSecond * 3.6;
  return `${Math.round(kmh)} km/h`;
};
