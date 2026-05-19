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

export const sendRideRequest = async (targetUserId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/send-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId }),
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
  factory_name?: string;
  factory_address?: string;
  factory_lat?: number;
  factory_lng?: number;
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

export const createRequest = async (
  ownerId: string,
  goodsType: string,
  weightKg: number,
  pickupAddress: string,
  dropAddress: string,
) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gozo/create-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId, goodsType, weightKg, pickupAddress, dropAddress }),
    });
    const data = await response.json();
    return {
      success: data.success,
      requestId: data.requestId,
      notifiedCount: data.notifiedCount,
      error: data.error,
    };
  } catch (error: any) {
    return { success: false, requestId: null, notifiedCount: 0, error: error.message };
  }
};

export const fetchMyRequests = async (ownerId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gozo/requests/${ownerId}`);
    const data = await response.json();
    return { success: data.success, requests: data.requests ?? [], error: data.error };
  } catch (error: any) {
    return { success: false, requests: [], error: error.message };
  }
};

export const fetchTransportCompanies = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/gozo/transport-companies`);
    const data = await response.json();
    return { success: data.success, companies: data.companies ?? [], error: data.error };
  } catch (error: any) {
    return { success: false, companies: [], error: error.message };
  }
};

export const fetchRequestDetails = async (requestId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gozo/request-details/${requestId}`);
    const data = await response.json();
    return { success: data.success, request: data.request ?? null, error: data.error };
  } catch (error: any) {
    return { success: false, request: null, error: error.message };
  }
};

export const rateTrip = async (requestId: string, rating: number) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gozo/rate-trip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, rating }),
    });
    const data = await response.json();
    return { success: data.success, error: data.error };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const fetchDriverLocation = async (requestId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gozo/driver-location/${requestId}`);
    const data = await response.json();
    return {
      success: data.success,
      location: data.location ?? null,
      error: data.error,
    };
  } catch (error: any) {
    return { success: false, location: null, error: error.message };
  }
};

