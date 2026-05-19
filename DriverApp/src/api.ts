import { API_BASE_URL } from './config';

export const registerToken = async (userId: string, fcmToken: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/register-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, fcmToken }),
    });
    const data = await response.json();
    return { success: data.success, error: data.error };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

type GozoUserRole = 'owner' | 'transporter';

export const registerUser = async (
  name: string,
  phone: string,
  role: GozoUserRole,
  fcmToken: string,
) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gozo/register-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, role, fcmToken }),
    });
    const data = await response.json();
    return { success: data.success, userId: data.userId, error: data.error };
  } catch (error: any) {
    return { success: false, userId: null, error: error.message };
  }
};

export const loginUser = async (phone: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gozo/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    return await response.json();
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const verifyOtp = async (phone: string, otp: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gozo/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp }),
    });
    return await response.json();
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const signupUser = async (params: {
  phone: string;
  name: string;
  role: GozoUserRole;
  fcmToken?: string;
}) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gozo/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await response.json();
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const acceptRequest = async (requestId: string, transporterId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gozo/accept-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, transporterId }),
    });
    const data = await response.json();
    return { success: data.success, acceptedPrice: data.acceptedPrice, error: data.error };
  } catch (error: any) {
    return { success: false, acceptedPrice: null, error: error.message };
  }
};

export const declineRequest = async (requestId: string, transporterId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gozo/decline-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, transporterId }),
    });
    const data = await response.json();
    return { success: data.success, error: data.error };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const fetchActiveRequests = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/gozo/active-requests`);
    const data = await response.json();
    return { success: data.success, requests: data.requests ?? [], error: data.error };
  } catch (error: any) {
    return { success: false, requests: [], error: error.message };
  }
};

export const updateTripStatus = async (
  requestId: string,
  transporterId: string,
  status: 'picked_up' | 'on_the_way' | 'completed',
) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gozo/update-trip-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, transporterId, status }),
    });
    const data = await response.json();
    return { success: data.success, error: data.error };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const updateDriverLocation = async (
  requestId: string,
  transporterId: string,
  latitude: number,
  longitude: number,
  heading: number,
) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gozo/update-location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, transporterId, latitude, longitude, heading }),
    });
    const data = await response.json();
    return { success: data.success, error: data.error };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const uploadBuilty = async (
  requestId: string,
  transporterId: string,
  builtyImage: string, // base64-encoded image
) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gozo/upload-builty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, transporterId, builtyImage }),
    });
    const data = await response.json();
    return { success: data.success, error: data.error };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const fetchDriverHistory = async (transporterId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gozo/driver-history/${transporterId}`);
    const data = await response.json();
    return { success: data.success, requests: data.requests ?? [], error: data.error };
  } catch (error: any) {
    return { success: false, requests: [], error: error.message };
  }
};

