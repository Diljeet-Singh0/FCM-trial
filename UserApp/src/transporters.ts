// Real transport companies data
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
  rateDisplay?: string;
  rating: number;
  totalRatings: number;
  routes: string[];
  depotAddress: string;
  vehicleTypes: VehicleType[];
  description: string;
  established: string;
  contactPhone: string;
  experience: string;
  deliveryTime: string;
  additionalInfo: string;
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
    name: 'Ludhiana Calcutta Transport',
    location: 'West Bengal (Kolkata)',
    ratePerKg: 6,
    rateDisplay: '4-8',
    rating: 4.5,
    totalRatings: 420,
    routes: [
      'West Bengal (Kolkata)',
    ],
    depotAddress: 'Ludhiana Calcutta Transport, Transport Nagar, Ludhiana, Punjab 141003',
    vehicleTypes: VEHICLE_TYPES.slice(2, 5),
    description: 'Specialized in Ludhiana–Kolkata corridor with 100-120 ton daily capacity. Reliable heavy-load freight for industrial goods across Punjab and West Bengal.',
    established: '1974',
    contactPhone: '9876500001',
    experience: '50+',
    deliveryTime: '7 days',
    additionalInfo: '100-120 ton daily capacity',
  },
  {
    id: 'tc-002',
    name: 'Mahindra Translogistics',
    location: 'Maharashtra, Karnataka',
    ratePerKg: 6,
    rateDisplay: '5-7',
    rating: 4.3,
    totalRatings: 310,
    routes: [
      'Maharashtra',
      'Karnataka',
    ],
    depotAddress: 'Mahindra Translogistics, Transport Nagar, Mumbai, Maharashtra 400001',
    vehicleTypes: VEHICLE_TYPES.slice(1, 5),
    description: 'Covering Maharashtra and Karnataka with a strong fleet. Office located in Transport Nagar. Trusted for consistent timely deliveries across Western and Southern India.',
    established: '1979',
    contactPhone: '9876500002',
    experience: '45+',
    deliveryTime: '5-6 days',
    additionalInfo: 'Office in Transport Nagar',
  },
  {
    id: 'tc-003',
    name: 'Surjit Goods Carrier Pvt Ltd',
    location: 'Punjab, Haryana, J&K, Delhi, HP',
    ratePerKg: 3,
    rateDisplay: '2-4',
    rating: 4.7,
    totalRatings: 580,
    routes: [
      'Punjab (Amritsar, Ajnala, Batala, Gurdaspur, Pathankot, Hoshiarpur, Jalandhar, Phagwara, Nakodar, Kapurthala, Sultanpur Lodhi, Nawanshahr, Balachaur, Ludhiana, Doraha, Khanna, Samrala, Mandi Gobindgarh, Sirhind, Rajpura, Patiala, Nabha, Malerkotla, Ahmedgarh, Barnala, Sangrur, Sunam, Lehragaga, Dhuri, Raikot, Jagraon, Moga, Kotkapura, Faridkot, Ferozepur, Fazilka, Zira, Jalalabad, Muktsar, Abohar, Tarn Taran, Patti, Khemkaran, Dasuya, Mukerian)',
      'Haryana (Ambala, Ambala City, Ambala Cantt, Shahbad, Kurukshetra, Karnal, Panipat, Sonipat)',
      'Jammu & Kashmir (Jammu, Kathua, Samba, Dori Brahmana, Vijaypur)',
      'Delhi (Delhi)',
      'Himachal Pradesh (Baddi, Damtal)',
    ],
    depotAddress: 'Surjit Goods Carrier Pvt Ltd, Transport Nagar, Ludhiana, Punjab 141003',
    vehicleTypes: VEHICLE_TYPES,
    description: 'Massive coverage across Punjab, Haryana, Jammu & Kashmir, Delhi, and Himachal Pradesh with 1-2 day delivery. Different rates per region. One of the most connected carriers in North India.',
    established: '1979',
    contactPhone: '9876500003',
    experience: '45+',
    deliveryTime: '1-2 days',
    additionalInfo: 'Different rates per region',
  },
  {
    id: 'tc-004',
    name: 'North Eastern Carrying Corporation (NCC)',
    location: 'Assam, Bihar, West Bengal, Odisha, Jharkhand',
    ratePerKg: 2.5,
    rateDisplay: '2-3',
    rating: 4.4,
    totalRatings: 390,
    routes: [
      'Assam (Guwahati, Shillong, Jorhat, Dibrugarh, Tinsukia, Silchar, Karimganj, Agartala, Lalabazar, Aizawl, Hailakandi, Dharmanagar, Imphal, Dimapur, Nagaon, Lanka, Gola Ghat, Hojai)',
      'Bihar (Patna Jn, Patna City, Gaya, Siwan, Chapra, Muzaffarpur, Darbhanga, Sitamarhi, Samastipur, Raxaul, Purnea, Forbesganj, Katihar, Jogbani, Bhagalpur, Araria, Sanouli, Kathmandu)',
      'West Bengal (Kolkata, Siliguri, Darjeeling, Cooch Behar, Jaigaon, Dinhata)',
      'Odisha (Cuttack, Bhubaneswar, Puri, Sambalpur, Rourkela, Berhampur, Jharsuguda)',
      'Jharkhand (Ranchi, Dhanbad, Jamshedpur, Tatanagar, Asansol, Chas, Giridih)',
    ],
    depotAddress: 'NCC Transport Hub, Transport Nagar, Ludhiana, Punjab 141003',
    vehicleTypes: VEHICLE_TYPES.slice(2, 5),
    description: 'Specialized in North-East India routes covering Assam, Bihar, West Bengal, Odisha, Jharkhand, and all Seven Sister states. Different rates per region. The most trusted name for North-East cargo.',
    established: '1969',
    contactPhone: '9876500004',
    experience: '55+',
    deliveryTime: '10-20 days',
    additionalInfo: 'Specialized in North-East routes, Different rates per region',
  },
];
