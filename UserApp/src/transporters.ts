// Static dummy transport companies data
// In a future phase this can come from a Supabase table

export type VehicleType = {
  id: string;
  name: string;
  maxWeightKg: number;
  icon: string;
};

export type TransportCompany = {
  id: string;
  name: string;
  location: string;
  ratePerKg: number;
  rating: number;
  totalRatings: number;
  routes: string[];
  depotAddress: string;
  vehicleTypes: VehicleType[];
  description: string;
  established: string;
  contactPhone: string;
};

export const VEHICLE_TYPES: VehicleType[] = [
  { id: 'auto', name: '3-Wheeler Auto', maxWeightKg: 500, icon: '🛺' },
  { id: 'mini-truck', name: 'Mini Truck (Tata Ace)', maxWeightKg: 1500, icon: '🚚' },
  { id: 'medium-truck', name: 'Medium Truck (Eicher 14ft)', maxWeightKg: 5000, icon: '🚛' },
  { id: 'full-truck', name: 'Full Truck (Tata 22ft)', maxWeightKg: 10000, icon: '🚛' },
  { id: 'trailer', name: 'Trailer (40ft)', maxWeightKg: 25000, icon: '🚛' },
];

export const suggestVehicle = (weightKg: number): VehicleType => {
  for (const vehicle of VEHICLE_TYPES) {
    if (weightKg <= vehicle.maxWeightKg) {
      return vehicle;
    }
  }
  return VEHICLE_TYPES[VEHICLE_TYPES.length - 1];
};

export const AUTO_LOADING_CHARGE = 150; // ₹ flat charge for auto-rickshaw loading

export const calculatePrice = (
  ratePerKg: number,
  weightKg: number,
): { companyCharge: number; autoCharge: number; total: number } => {
  const companyCharge = Math.round(ratePerKg * weightKg);
  const autoCharge = AUTO_LOADING_CHARGE;
  return {
    companyCharge,
    autoCharge,
    total: companyCharge + autoCharge,
  };
};

export const TRANSPORT_COMPANIES: TransportCompany[] = [
  {
    id: 'tc-001',
    name: 'RapidCargo Express',
    location: 'Rajpura, Punjab',
    ratePerKg: 8,
    rating: 4.5,
    totalRatings: 328,
    routes: ['Rajpura → Chandigarh', 'Rajpura → Delhi', 'Rajpura → Ludhiana', 'Rajpura → Ambala'],
    depotAddress: 'RapidCargo Depot, GT Road, Rajpura, Punjab 140401',
    vehicleTypes: VEHICLE_TYPES.slice(0, 4),
    description: 'Fast and reliable cargo transport across Punjab and North India. Specializing in electronics and fragile goods.',
    established: '2018',
    contactPhone: '9876500001',
  },
  {
    id: 'tc-002',
    name: 'Punjab Freight Lines',
    location: 'Patiala, Punjab',
    ratePerKg: 6,
    rating: 4.2,
    totalRatings: 215,
    routes: ['Patiala → Delhi', 'Patiala → Chandigarh', 'Patiala → Bathinda', 'Patiala → Jaipur'],
    depotAddress: 'Punjab Freight Depot, Sirhind Road, Patiala, Punjab 147001',
    vehicleTypes: VEHICLE_TYPES.slice(1, 5),
    description: 'Affordable freight solutions with extensive coverage across Punjab and Rajasthan. Best for bulk goods.',
    established: '2015',
    contactPhone: '9876500002',
  },
  {
    id: 'tc-003',
    name: 'TruckWale Logistics',
    location: 'Ludhiana, Punjab',
    ratePerKg: 10,
    rating: 4.8,
    totalRatings: 512,
    routes: ['Ludhiana → Delhi', 'Ludhiana → Mumbai', 'Ludhiana → Chandigarh', 'Ludhiana → Amritsar'],
    depotAddress: 'TruckWale Hub, Focal Point, Ludhiana, Punjab 141010',
    vehicleTypes: VEHICLE_TYPES,
    description: 'Premium logistics partner with GPS-tracked fleet. All-India coverage with priority handling and insurance.',
    established: '2012',
    contactPhone: '9876500003',
  },
  {
    id: 'tc-004',
    name: 'Gill Transport Co.',
    location: 'Amritsar, Punjab',
    ratePerKg: 5,
    rating: 3.9,
    totalRatings: 178,
    routes: ['Amritsar → Delhi', 'Amritsar → Jammu', 'Amritsar → Ludhiana', 'Amritsar → Pathankot'],
    depotAddress: 'Gill Transport Yard, Majitha Road, Amritsar, Punjab 143001',
    vehicleTypes: VEHICLE_TYPES.slice(1, 4),
    description: 'Budget-friendly transport with strong presence in North Punjab and Jammu region. Family-run since 1995.',
    established: '1995',
    contactPhone: '9876500004',
  },
  {
    id: 'tc-005',
    name: 'SpeedLine Movers',
    location: 'Chandigarh',
    ratePerKg: 12,
    rating: 4.6,
    totalRatings: 402,
    routes: ['Chandigarh → Delhi', 'Chandigarh → Mumbai', 'Chandigarh → Shimla', 'Chandigarh → Dehradun'],
    depotAddress: 'SpeedLine Depot, Industrial Area Phase II, Chandigarh 160002',
    vehicleTypes: VEHICLE_TYPES,
    description: 'Express delivery specialist. Same-day and next-day delivery options. Climate-controlled vehicles available.',
    established: '2016',
    contactPhone: '9876500005',
  },
  {
    id: 'tc-006',
    name: 'Khalsa Roadways',
    location: 'Bathinda, Punjab',
    ratePerKg: 4,
    rating: 4.0,
    totalRatings: 145,
    routes: ['Bathinda → Delhi', 'Bathinda → Chandigarh', 'Bathinda → Hisar', 'Bathinda → Patiala'],
    depotAddress: 'Khalsa Roadways Terminal, Goniana Road, Bathinda, Punjab 151001',
    vehicleTypes: VEHICLE_TYPES.slice(0, 3),
    description: 'Lowest rates in South Punjab. Specializing in agricultural products and bulk commodity transport.',
    established: '2010',
    contactPhone: '9876500006',
  },
];
