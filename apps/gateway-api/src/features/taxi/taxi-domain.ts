export type TaxiDriverStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'OFFLINE';
export type TaxiAvailabilityStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE';
export type TaxiReservationStatus = 'REQUESTED' | 'ACCEPTED' | 'DRIVER_CALLED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type TaxiCallType = 'DIRECT_PHONE' | 'WHATSAPP' | 'IN_APP_REQUEST';
export type TaxiDocumentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface TaxiVehicle {
  id: string;
  carType?: string;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  platePublicLastDigits?: string;
  plateType: 'RED_PUBLIC' | 'COMMERCIAL' | 'PRIVATE' | 'UNKNOWN';
  seats?: number;
  hasInsurance: boolean;
  hasInspection: boolean;
  hasFireExtinguisher: boolean;
  status?: TaxiDocumentStatus;
  listed?: boolean;
}

export interface TaxiServiceArea {
  profileImageUrl?: string;
  id: string;
  muhafaza?: string;
  caza?: string;
  village?: string;
  notes?: string;
}

export interface TaxiDriverProfileUpdateInput {
  fullName?: string;
  phone?: string;
  whatsappPhone?: string;
  profileImageUrl?: string;
  notes?: string;
}

export interface TaxiVehicleInput {
  carType?: string;
  id?: string;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  platePublicLastDigits?: string;
  plateType?: TaxiVehicle['plateType'];
  seats?: number;
  hasInsurance?: boolean;
  hasInspection?: boolean;
  hasFireExtinguisher?: boolean;
  listed?: boolean;
}

export interface TaxiServiceAreaInput {
  muhafaza?: string;
  caza?: string;
  village?: string;
  notes?: string;
}

export interface TaxiAvailability {
  id: string;
  driverId: string;
  status: TaxiAvailabilityStatus;
  locationLabel?: string;
  lat?: number;
  lng?: number;
  availableUntil?: string;
  lastSeenAt: string;
}

export interface TaxiDriverProfile {
  id: string;
  userId?: string;
  fullName: string;
  phone: string;
  whatsappPhone?: string;
  profileImageUrl?: string;
  status: TaxiDriverStatus;
  verificationLevel: 'BASIC' | 'LICENSED' | 'TRUSTED';
  notes?: string;
  vehicles: TaxiVehicle[];
  serviceAreas: TaxiServiceArea[];
  currentAvailability?: TaxiAvailability;
  createdAt: string;
  updatedAt: string;
}

export interface TaxiReservation {
  id: string;
  riderUserId?: string;
  driverId: string;
  pickupText: string;
  pickupLat?: number;
  pickupLng?: number;
  destinationText?: string;
  scheduledAt?: string;
  status: TaxiReservationStatus;
  priceAgreementText?: string;
  notes?: string;
  createdAt: string;
}

export interface TaxiDriverApplicationInput {
  fullName: string;
  phone: string;
  whatsappPhone?: string;
  profileImageUrl?: string;
  notes?: string;
  vehicleCarType?: string;
  vehicleColor?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  platePublicLastDigits?: string;
  plateType?: TaxiVehicle['plateType'];
  muhafaza?: string;
  caza?: string;
  village?: string;
}

export interface TaxiAvailabilityInput {
  status: TaxiAvailabilityStatus;
  locationLabel?: string;
  lat?: number;
  lng?: number;
  availableUntil?: string;
}

export interface TaxiSearchQuery {
  q?: string;
  muhafaza?: string;
  caza?: string;
  village?: string;
  lat?: number;
  lng?: number;
}

export interface TaxiReservationInput {
  driverId: string;
  pickupText: string;
  pickupLat?: number;
  pickupLng?: number;
  destinationText?: string;
  scheduledAt?: string;
  notes?: string;
}

export function isDriverPubliclyVisible(driver: TaxiDriverProfile): boolean {
  return driver.status === 'APPROVED' && driver.currentAvailability?.status === 'AVAILABLE';
}

export function formatTaxiAvailabilityArabic(status: TaxiAvailabilityStatus): string {
  if (status === 'AVAILABLE') return 'متاح الآن';
  if (status === 'BUSY') return 'مشغول';
  return 'غير متاح';
}