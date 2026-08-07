export type TaxiAccreditedDriverDemo = {
  id: string;
  name: string;
  area: string;
  vehicle: string;
  plate: string;
  rating: number;
  trips: number;
  etaMinutes: number;
  phone: string;
  supportsAirport: boolean;
  supportsFamilyRide: boolean;
};

export const taxiAccreditedDriverDemoListings: TaxiAccreditedDriverDemo[] = [
  {
    id: 'accredited-demo-001',
    name: 'يوسف خليل',
    area: 'بيروت',
    vehicle: 'Toyota Corolla 2020 — أبيض',
    plate: 'B 245781',
    rating: 4.9,
    trips: 123,
    etaMinutes: 5,
    phone: '03000111',
    supportsAirport: true,
    supportsFamilyRide: true,
  },
  {
    id: 'accredited-demo-002',
    name: 'أحمد منصور',
    area: 'المتن',
    vehicle: 'Hyundai Elantra 2021 — فضي',
    plate: 'M 394220',
    rating: 4.8,
    trips: 87,
    etaMinutes: 7,
    phone: '03000222',
    supportsAirport: true,
    supportsFamilyRide: false,
  },
  {
    id: 'accredited-demo-003',
    name: 'سالم حيدر',
    area: 'كسروان',
    vehicle: 'Kia Cerato 2019 — رمادي',
    plate: 'K 188502',
    rating: 4.7,
    trips: 56,
    etaMinutes: 10,
    phone: '03000333',
    supportsAirport: false,
    supportsFamilyRide: true,
  },
  {
    id: 'accredited-demo-004',
    name: 'نبيل عيسى',
    area: 'الشمال',
    vehicle: 'Renault Logan 2022 — أبيض',
    plate: 'N 441990',
    rating: 4.9,
    trips: 201,
    etaMinutes: 8,
    phone: '03000555',
    supportsAirport: true,
    supportsFamilyRide: true,
  },
];

export const TAXI_ACCREDITED_DRIVER_DEMO_LISTINGS_ONLY = true as const;
