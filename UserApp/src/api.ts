import { API_BASE_URL } from './config';

// Helper: safely parse JSON responses. When the backend (Render free tier) is
// cold-starting or down it returns HTML error pages which cause
// "unexpected character <" if we blindly call response.json().
const safeJsonParse = async (response: Response): Promise<any> => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    console.warn('[API] Non-JSON response:', response.status, text.substring(0, 200));
    return { success: false, error: `Server error (${response.status}). Please try again.` };
  }
};

export const registerToken = async (userId: string, fcmToken: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/register-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, fcmToken }),
    });
    const data = await safeJsonParse(response);
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
    const data = await safeJsonParse(response);
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
    const data = await safeJsonParse(response);
    return { success: data.success, userId: data.userId, error: data.error };
  } catch (error: any) {
    return { success: false, userId: null, error: error.message };
  }
};

export const loginUser = async (phone: string, expectedRole?: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gozo/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, expectedRole }),
    });
    return await safeJsonParse(response);
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const verifyOtp = async (phone: string, otp: string, expectedRole?: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gozo/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp, expectedRole }),
    });
    return await safeJsonParse(response);
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
    return await safeJsonParse(response);
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
  distanceKm?: number,
) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gozo/create-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId, goodsType, weightKg, pickupAddress, dropAddress, distanceKm }),
    });
    const data = await safeJsonParse(response);
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
    const data = await safeJsonParse(response);
    return { success: data.success, requests: data.requests ?? [], error: data.error };
  } catch (error: any) {
    return { success: false, requests: [], error: error.message };
  }
};

export const fetchTransportCompanies = async (ownerId?: string) => {
  try {
    const url = `${API_BASE_URL}/gozo/transport-companies${ownerId ? `?owner_id=${encodeURIComponent(ownerId)}` : ''}`;
    const response = await fetch(url);
    const data = await safeJsonParse(response);
    return { success: data.success, companies: data.companies ?? [], error: data.error };
  } catch (error: any) {
    return { success: false, companies: [], error: error.message };
  }
};

export const fetchRequestDetails = async (requestId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gozo/request-details/${requestId}`);
    const data = await safeJsonParse(response);
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
    const data = await safeJsonParse(response);
    return { success: data.success, error: data.error };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const fetchDriverLocation = async (requestId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gozo/driver-location/${requestId}`);
    const data = await safeJsonParse(response);
    return {
      success: data.success,
      location: data.location ?? null,
      error: data.error,
    };
  } catch (error: any) {
    return { success: false, location: null, error: error.message };
  }
};

export const fetchPriceEstimate = async (goodsType: string, weightKg: number, distanceKm?: number) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gozo/estimate-price`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goodsType, weightKg, distanceKm }),
    });
    const data = await safeJsonParse(response);
    return { success: data.success, estimate: data.estimate ?? null, error: data.error };
  } catch (error: any) {
    return { success: false, estimate: null, error: error.message };
  }
};

export const fetchUserProfile = async (userId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gozo/user/${userId}`);
    const data = await safeJsonParse(response);
    return { success: data.success, user: data.user ?? null, error: data.error };
  } catch (error: any) {
    return { success: false, user: null, error: error.message };
  }
};

export const fetchCompanyImages = async (companyId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gozo/company-images/${companyId}`);
    const data = await safeJsonParse(response);
    return { success: data.success, images: data.images ?? [], error: data.error };
  } catch (error: any) {
    return { success: false, images: [], error: error.message };
  }
};

export const cancelRequest = async (requestId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gozo/cancel-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId }),
    });
    const data = await safeJsonParse(response);
    return { success: data.success, error: data.error };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const fetchCertificate = async (tripId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gozo/trips/${tripId}/certificate`);
    const data = await safeJsonParse(response);
    return { success: data.success, certificate: data.certificate ?? null, error: data.error };
  } catch (error: any) {
    return { success: false, certificate: null, error: error.message };
  }
};

export const fetchDestinations = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/gozo/transport-companies/destinations`);
    const data = await safeJsonParse(response);
    return { success: data.success, destinations: data.destinations ?? [], error: data.error };
  } catch (error: any) {
    return { success: false, destinations: [], error: error.message };
  }
};

export const searchTransportCompanies = async (destination: string, pickupCity?: string, ownerId?: string) => {
  try {
    const url = `${API_BASE_URL}/gozo/transport-companies/search?destination=${encodeURIComponent(destination)}${pickupCity ? `&pickup_city=${encodeURIComponent(pickupCity)}` : ''}${ownerId ? `&owner_id=${encodeURIComponent(ownerId)}` : ''}`;
    const response = await fetch(url);
    const data = await safeJsonParse(response);
    return { success: data.success, companies: data.companies ?? [], error: data.error };
  } catch (error: any) {
    return { success: false, companies: [], error: error.message };
  }
};

export const addCustomTransportCompany = async (
  ownerId: string,
  company: {
    name: string;
    depotAddress: string;
    contactPhone?: string;
    destination?: string;
    deliveryTime?: string;
    ratePerKg?: number;
  }
) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gozo/transport-companies/custom`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        owner_id: ownerId,
        name: company.name,
        depot_address: company.depotAddress,
        contact_phone: company.contactPhone,
        destination: company.destination,
        delivery_time: company.deliveryTime,
        rate_per_kg: company.ratePerKg,
      }),
    });
    const data = await safeJsonParse(response);
    return { success: data.success, company: data.company ?? null, error: data.error };
  } catch (error: any) {
    return { success: false, company: null, error: error.message };
  }
};

export const createScheduledRide = async (payload: {
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
}) => {
  try {
    const response = await fetch(`${API_BASE_URL}/scheduled-rides`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await safeJsonParse(response);
    return { success: data.success, ride: data.ride ?? null, error: data.error };
  } catch (error: any) {
    return { success: false, ride: null, error: error.message };
  }
};

export const fetchUserScheduledRides = async (userId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/scheduled-rides/user/${userId}`);
    const data = await safeJsonParse(response);
    return { success: data.success, rides: data.rides ?? [], error: data.error };
  } catch (error: any) {
    return { success: false, rides: [], error: error.message };
  }
};

export const fetchScheduledRideDetail = async (rideId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/scheduled-rides/${rideId}`);
    const data = await safeJsonParse(response);
    return { success: data.success, ride: data.ride ?? null, error: data.error };
  } catch (error: any) {
    return { success: false, ride: null, error: error.message };
  }
};

export const cancelScheduledRide = async (rideId: string, cancelledBy: 'user' | 'driver' | 'admin', reason?: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/scheduled-rides/${rideId}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cancelled_by: cancelledBy, cancellation_reason: reason }),
    });
    const data = await safeJsonParse(response);
    return { success: data.success, ride: data.ride ?? null, error: data.error };
  } catch (error: any) {
    return { success: false, ride: null, error: error.message };
  }
};

