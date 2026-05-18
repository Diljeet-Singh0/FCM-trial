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
    location: 'Ludhiana, Punjab',
    ratePerKg: 6,
    rating: 4.5,
    totalRatings: 420,
    routes: [
      'Ludhiana → Kolkata',
      'Ludhiana → West Bengal',
    ],
    depotAddress: 'Ludhiana Calcutta Transport, Transport Nagar, Ludhiana, Punjab 141003',
    vehicleTypes: VEHICLE_TYPES.slice(2, 5),
    description: 'Specialized in Ludhiana–Kolkata corridor with 100-120 ton daily capacity. Reliable heavy-load freight for industrial goods across Punjab and West Bengal.',
    established: '1974',
    contactPhone: '9876500001',
    experience: '50+ years',
    deliveryTime: '7 days',
    additionalInfo: '100-120 ton daily capacity',
  },
  {
    id: 'tc-002',
    name: 'Mahindra Translogistics',
    location: 'Maharashtra',
    ratePerKg: 6,
    rating: 4.3,
    totalRatings: 310,
    routes: [
      'Maharashtra → Karnataka',
      'Mumbai → Bangalore',
      'Pune → Hubli',
      'Nagpur → Hyderabad',
    ],
    depotAddress: 'Mahindra Translogistics, Transport Nagar, Mumbai, Maharashtra 400001',
    vehicleTypes: VEHICLE_TYPES.slice(1, 5),
    description: 'Covering Maharashtra and Karnataka with a strong fleet. Office located in Transport Nagar. Trusted for consistent timely deliveries across Western and Southern India.',
    established: '1979',
    contactPhone: '9876500002',
    experience: '45+ years',
    deliveryTime: '5-6 days',
    additionalInfo: 'Office in Transport Nagar',
  },
  {
    id: 'tc-003',
    name: 'Surjit Goods Carrier Pvt Ltd',
    location: 'Punjab',
    ratePerKg: 3,
    rating: 4.7,
    totalRatings: 580,
    routes: [
      'Punjab (Amritsar, Ajnala, Batala, Gurdaspur, Pathankot)',
      'Punjab (Hoshiarpur, Jalandhar, Phagwara, Nakodar, Kapurthala)',
      'Punjab (Sultanpur Lodhi, Nawanshahr, Balachaur, Ludhiana, Doraha)',
      'Punjab (Khanna, Samrala, Mandi Gobindgarh, Sirhind, Rajpura)',
      'Punjab (Patiala, Nabha, Malerkotla, Ahmedgarh, Barnala)',
      'Punjab (Sangrur, Sunam, Lehragaga, Dhuri, Raikot, Jagraon)',
      'Punjab (Moga, Kotkapura, Faridkot, Ferozepur, Fazilka)',
      'Punjab (Zira, Jalalabad, Muktsar, Abohar, Tarn Taran)',
      'Punjab (Patti, Khemkaran, Dasuya, Mukerian)',
      'Haryana (Ambala, Ambala City, Ambala Cantt, Shahbad)',
      'Haryana (Kurukshetra, Karnal, Panipat, Sonipat)',
      'J&K (Jammu, Kathua, Samba, Dori Brahmana, Vijaypur)',
      'Delhi',
      'Himachal Pradesh (Baddi, Damtal)',
    ],
    depotAddress: 'Surjit Goods Carrier Pvt Ltd, Transport Nagar, Ludhiana, Punjab 141003',
    vehicleTypes: VEHICLE_TYPES,
    description: 'Massive coverage across Punjab, Haryana, Jammu & Kashmir, Delhi, and Himachal Pradesh with 1-2 day delivery. Different rates per region. One of the most connected carriers in North India.',
    established: '1979',
    contactPhone: '9876500003',
    experience: '45+ years',
    deliveryTime: '1-2 days',
    additionalInfo: 'Different rates per region',
  },
  {
    id: 'tc-004',
    name: 'North Eastern Carrying Corporation (NCC)',
    location: 'Assam / North-East India',
    ratePerKg: 3,
    rating: 4.4,
    totalRatings: 390,
    routes: [
      'Assam (Guwahati, Shillong, Jorhat, Dibrugarh, Tinsukia)',
      'Assam (Silchar, Karimganj, Lalabazar, Nagaon, Lanka)',
      'Assam (Gola Ghat, Hojai)',
      'Mizoram (Aizawl)',
      'Tripura (Agartala, Dharmanagar)',
      'Manipur (Imphal)',
      'Nagaland (Dimapur)',
      'Meghalaya (Shillong)',
      'Bihar (Patna Jn, Patna City, Gaya, Siwan, Chapra)',
      'Bihar (Muzaffarpur, Darbhanga, Sitamarhi, Samastipur, Raxaul)',
      'Bihar (Purnea, Forbesganj, Katihar, Jogbani, Bhagalpur)',
      'Bihar (Araria, Sanouli, Kathmandu)',
      'West Bengal (Kolkata, Siliguri, Darjeeling, Cooch Behar)',
      'West Bengal (Jaigaon, Dinhata)',
      'Odisha (Cuttack, Bhubaneswar, Puri, Sambalpur, Rourkela)',
      'Odisha (Berhampur, Jharsuguda)',
      'Jharkhand (Ranchi, Dhanbad, Jamshedpur, Tatanagar)',
      'Jharkhand (Asansol, Chas, Giridih)',
    ],
    depotAddress: 'NCC Transport Hub, Transport Nagar, Ludhiana, Punjab 141003',
    vehicleTypes: VEHICLE_TYPES.slice(2, 5),
    description: 'Specialized in North-East India routes covering Assam, Bihar, West Bengal, Odisha, Jharkhand, and all Seven Sister states. Different rates per region. The most trusted name for North-East cargo.',
    established: '1969',
    contactPhone: '9876500004',
    experience: '55+ years',
    deliveryTime: '10-20 days',
    additionalInfo: 'Specialized in North-East routes, Different rates per region',
  },
];
