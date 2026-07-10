import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './config';

// Helper to get authorization headers
const getHeaders = async () => {
  const token = await AsyncStorage.getItem('gozo_admin_token');
  return {
    'Content-Type': 'application/json',
    'x-admin-token': token || '',
  };
};

export interface Driver {
  id: string;
  name: string;
  phone: string;
  vehicle_number: string;
  vehicle_type: string;
  status: 'offline' | 'available' | 'in_ride';
}

export interface Ride {
  id: string;
  booking_id?: string;
  status: string;
  goods_type: string;
  weight_kg: number;
  pickup_address: string;
  drop_address: string;
  created_at: string;
  updated_at: string;
  price_inr?: number;
  user?: {
    id: string;
    name: string;
    phone: string;
    factory_name?: string;
    factory_address?: string;
  } | null;
  driver?: Driver | null;
  timeline?: Array<{
    status: string;
    active: boolean;
    time: string;
  }>;
}

export interface ScheduledRide {
  id: string;
  booking_id: string;
  user_id: string;
  pickup_location: string;
  pickup_lat?: number;
  pickup_lng?: number;
  drop_location: string;
  drop_lat?: number;
  drop_lng?: number;
  goods_description?: string;
  scheduled_time: string;
  company_id?: string;
  driver_id?: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  user?: {
    id: string;
    name: string;
    phone: string;
    factory_name?: string;
  } | null;
  driver?: {
    id: string;
    name: string;
    phone: string;
    vehicle_number?: string;
  } | null;
  company?: {
    id: string;
    name: string;
    location?: string;
    contact_phone?: string;
  } | null;
}

// Authenticate with admin PIN
export const loginAdmin = async (password: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: password }),
    });
    const data = await response.json();
    if (data.success && data.token) {
      await AsyncStorage.setItem('gozo_admin_token', data.token);
      await AsyncStorage.setItem('gozo_admin_logged_in', 'true');
      return { success: true, token: data.token };
    }
    return { success: false, error: data.error || 'Authentication failed' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Register admin FCM token
export const registerAdminFcmToken = async (token: string) => {
  try {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/admin/fcm-token`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ token }),
    });
    const data = await response.json();
    return { success: data.success, error: data.error };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// GET /admin/drivers/status
export const fetchDriversWithStatus = async (): Promise<{ success: boolean; drivers: Driver[]; error?: string }> => {
  try {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/admin/drivers/status`, { headers });
    const data = await response.json();
    return { success: data.success, drivers: data.drivers ?? [], error: data.error };
  } catch (error: any) {
    return { success: false, drivers: [], error: error.message };
  }
};

// GET /admin/rides
export const fetchRides = async (status?: string, date?: string): Promise<{ success: boolean; rides: Ride[]; error?: string }> => {
  try {
    const headers = await getHeaders();
    let url = `${API_BASE_URL}/admin/rides`;
    const params = new URLSearchParams();
    if (status && status !== 'All') params.append('status', status.toLowerCase());
    if (date) params.append('date', date);
    
    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;
    
    const response = await fetch(url, { headers });
    const data = await response.json();
    return { success: data.success, rides: data.rides ?? [], error: data.error };
  } catch (error: any) {
    return { success: false, rides: [], error: error.message };
  }
};

// GET /admin/rides/:requestId
export const fetchRideDetail = async (requestId: string): Promise<{ success: boolean; ride: Ride | null; error?: string }> => {
  try {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/admin/rides/${requestId}`, { headers });
    const data = await response.json();
    return { success: data.success, ride: data.ride ?? null, error: data.error };
  } catch (error: any) {
    return { success: false, ride: null, error: error.message };
  }
};

// GET /admin/drivers/:driverId/rides
export const fetchDriverRideHistory = async (
  driverId: string,
  limit = 10,
  offset = 0
): Promise<{ success: boolean; rides: Ride[]; error?: string }> => {
  try {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/admin/drivers/${driverId}/rides?limit=${limit}&offset=${offset}`, { headers });
    const data = await response.json();
    return { success: data.success, rides: data.rides ?? [], error: data.error };
  } catch (error: any) {
    return { success: false, rides: [], error: error.message };
  }
};

// GET /admin/scheduled-rides
export const fetchScheduledRides = async (status?: string, date?: string): Promise<{ success: boolean; rides: ScheduledRide[]; error?: string }> => {
  try {
    const headers = await getHeaders();
    let url = `${API_BASE_URL}/admin/scheduled-rides`;
    const params = new URLSearchParams();
    if (status && status !== 'All') params.append('status', status.toLowerCase());
    if (date) params.append('date', date);
    
    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;
    
    const response = await fetch(url, { headers });
    const data = await response.json();
    return { success: data.success, rides: data.rides ?? [], error: data.error };
  } catch (error: any) {
    return { success: false, rides: [], error: error.message };
  }
};

// GET /scheduled-rides/:rideId
export const fetchScheduledRideDetail = async (rideId: string): Promise<{ success: boolean; ride: ScheduledRide | null; error?: string }> => {
  try {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/scheduled-rides/${rideId}`, { headers });
    const data = await response.json();
    return { success: data.success, ride: data.ride ?? null, error: data.error };
  } catch (error: any) {
    return { success: false, ride: null, error: error.message };
  }
};

// PATCH /admin/scheduled-rides/:rideId/assign
export const assignDriverToScheduledRide = async (rideId: string, driverId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/admin/scheduled-rides/${rideId}/assign`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ driver_id: driverId }),
    });
    const data = await response.json();
    return { success: data.success, error: data.error };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// DELETE /admin/rides/:rideId
export const deleteRide = async (rideId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/admin/rides/${rideId}`, {
      method: 'DELETE',
      headers,
    });
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return { success: data.success, error: data.error };
    } else {
      const text = await response.text();
      return { success: false, error: `Server error (${response.status}): ${text.substring(0, 100)}` };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// DELETE /admin/scheduled-rides/:rideId
export const deleteScheduledRide = async (rideId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/admin/scheduled-rides/${rideId}`, {
      method: 'DELETE',
      headers,
    });
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return { success: data.success, error: data.error };
    } else {
      const text = await response.text();
      return { success: false, error: `Server error (${response.status}): ${text.substring(0, 100)}` };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// DELETE /admin/rides/clear-all
export const clearAllRides = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/admin/rides/clear-all`, {
      method: 'DELETE',
      headers,
    });
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return { success: data.success, error: data.error };
    } else {
      const text = await response.text();
      return { success: false, error: `Server error (${response.status}): ${text.substring(0, 100)}` };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Send a test notification
export const triggerTestNotification = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/admin/test-fcm`, {
      method: 'POST',
      headers,
    });
    const data = await response.json();
    return { success: data.success, error: data.error };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};
