export type TaxiDriverStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type TaxiAvailabilityStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE';

export interface TaxiVehicleView {
  color?: string;
  make?: string;
  model?: string;
  platePublicLastDigits?: string;
  plateType?: string;
}

export interface TaxiDriverView {
  id: string;
  fullName: string;
  phone: string;
  whatsappPhone?: string;
  status: TaxiDriverStatus;
  verificationLevel: 'BASIC' | 'LICENSED' | 'TRUSTED';
  vehicles: TaxiVehicleView[];
  currentAvailability?: {
    status: TaxiAvailabilityStatus;
    locationLabel?: string;
    lastSeenAt: string;
  };
}

export interface TaxiSearchResponse {
  ok: boolean;
  drivers: TaxiDriverView[];
  safetyNotice?: string;
}