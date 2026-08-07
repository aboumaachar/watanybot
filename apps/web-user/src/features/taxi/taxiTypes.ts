export type TaxiDriverStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type TaxiAvailabilityStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE';
export type TaxiReservationStatus = 'REQUESTED' | 'ACCEPTED' | 'DRIVER_CALLED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export type TaxiDriverCard = {
  id: string;
  name: string;
  phone: string;
  whatsapp?: string;
  areaLabel: string;
  vehicleLabel: string;
  platePublicLastDigits?: string;
  trustLabel: string;
  availability: TaxiAvailabilityStatus;
};

export const SAMPLE_TAXI_DRIVERS: TaxiDriverCard[] = [
  {
    id: 'demo-approved-taxi-1',
    name: 'سائق موثوق',
    phone: '+96100000000',
    whatsapp: '+96100000000',
    areaLabel: 'بيروت وجبل لبنان',
    vehicleLabel: 'سيارة عمومية مرخصة',
    platePublicLastDigits: '123',
    trustLabel: 'تم التحقق من السائق',
    availability: 'AVAILABLE',
  },
];