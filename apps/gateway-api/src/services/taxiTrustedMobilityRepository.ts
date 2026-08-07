export type TaxiDriverStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type TaxiAvailabilityStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE';

export type TaxiDriverRecord = {
  id: string;
  fullName: string;
  phone: string;
  whatsappPhone?: string;
  status: TaxiDriverStatus;
  areaLabel: string;
  vehicleLabel: string;
  platePublicLastDigits?: string;
  availability: TaxiAvailabilityStatus;
  updatedAt: string;
};

export type TaxiAdminSettings = {
  requireAdminApproval: boolean;
  allowPhoneContact: boolean;
  allowWhatsappContact: boolean;
  complaintsEnabled: boolean;
  privacyMaskPlateDigits: boolean;
  veteranPriorityOnly: boolean;
  maxActiveReservationsPerDriver: number;
  availabilityHeartbeatMinutes: number;
};

export type TaxiAdminMonitoringSnapshot = {
  totalDrivers: number;
  pendingDrivers: number;
  approvedDrivers: number;
  rejectedDrivers: number;
  suspendedDrivers: number;
  availableDrivers: number;
  busyDrivers: number;
  offlineDrivers: number;
  lastUpdatedAt: string | null;
};

const drivers: TaxiDriverRecord[] = [];

const settings: TaxiAdminSettings = {
  requireAdminApproval: true,
  allowPhoneContact: true,
  allowWhatsappContact: true,
  complaintsEnabled: true,
  privacyMaskPlateDigits: true,
  veteranPriorityOnly: true,
  maxActiveReservationsPerDriver: 3,
  availabilityHeartbeatMinutes: 30,
};

function latestDriverUpdateAt(): string | null {
  if (drivers.length === 0) return null;
  return drivers.reduce((latest, driver) => (
    latest === null || driver.updatedAt > latest ? driver.updatedAt : latest
  ), null as string | null);
}

function clampPositiveInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const integerValue = Math.trunc(value);
  if (integerValue <= 0) return fallback;
  return integerValue;
}

export const taxiTrustedMobilityRepository = {
  listApprovedAvailable(area?: string) {
    const normalizedArea = area?.trim().toLowerCase() ?? '';
    return drivers.filter((driver) => {
      if (driver.status !== 'APPROVED') return false;
      if (driver.availability !== 'AVAILABLE') return false;
      if (!normalizedArea) return true;
      return driver.areaLabel.toLowerCase().includes(normalizedArea);
    });
  },

  apply(input: Omit<TaxiDriverRecord, 'id' | 'status' | 'availability' | 'updatedAt'>) {
    const record: TaxiDriverRecord = {
      ...input,
      id: `taxi_${Date.now()}`,
      status: 'PENDING',
      availability: 'OFFLINE',
      updatedAt: new Date().toISOString(),
    };
    drivers.push(record);
    return record;
  },

  setAvailability(driverId: string, availability: TaxiAvailabilityStatus, areaLabel?: string) {
    const driver = drivers.find((item) => item.id === driverId);
    if (!driver) return null;
    driver.availability = availability;
    if (areaLabel) driver.areaLabel = areaLabel;
    driver.updatedAt = new Date().toISOString();
    return driver;
  },

  adminList() {
    return drivers;
  },

  adminSetStatus(driverId: string, status: TaxiDriverStatus) {
    const driver = drivers.find((item) => item.id === driverId);
    if (!driver) return null;
    driver.status = status;
    driver.updatedAt = new Date().toISOString();
    return driver;
  },

  adminGetMonitoring(): TaxiAdminMonitoringSnapshot {
    return {
      totalDrivers: drivers.length,
      pendingDrivers: drivers.filter((driver) => driver.status === 'PENDING').length,
      approvedDrivers: drivers.filter((driver) => driver.status === 'APPROVED').length,
      rejectedDrivers: drivers.filter((driver) => driver.status === 'REJECTED').length,
      suspendedDrivers: drivers.filter((driver) => driver.status === 'SUSPENDED').length,
      availableDrivers: drivers.filter((driver) => driver.availability === 'AVAILABLE').length,
      busyDrivers: drivers.filter((driver) => driver.availability === 'BUSY').length,
      offlineDrivers: drivers.filter((driver) => driver.availability === 'OFFLINE').length,
      lastUpdatedAt: latestDriverUpdateAt(),
    };
  },

  adminGetSettings(): TaxiAdminSettings {
    return { ...settings };
  },

  adminUpdateSettings(
    patch: Partial<TaxiAdminSettings>,
  ): TaxiAdminSettings {
    if (typeof patch.requireAdminApproval === 'boolean') {
      settings.requireAdminApproval = patch.requireAdminApproval;
    }
    if (typeof patch.allowPhoneContact === 'boolean') {
      settings.allowPhoneContact = patch.allowPhoneContact;
    }
    if (typeof patch.allowWhatsappContact === 'boolean') {
      settings.allowWhatsappContact = patch.allowWhatsappContact;
    }
    if (typeof patch.complaintsEnabled === 'boolean') {
      settings.complaintsEnabled = patch.complaintsEnabled;
    }
    if (typeof patch.privacyMaskPlateDigits === 'boolean') {
      settings.privacyMaskPlateDigits = patch.privacyMaskPlateDigits;
    }
    if (typeof patch.veteranPriorityOnly === 'boolean') {
      settings.veteranPriorityOnly = patch.veteranPriorityOnly;
    }
    if (typeof patch.maxActiveReservationsPerDriver === 'number') {
      settings.maxActiveReservationsPerDriver = clampPositiveInteger(
        patch.maxActiveReservationsPerDriver,
        settings.maxActiveReservationsPerDriver,
      );
    }
    if (typeof patch.availabilityHeartbeatMinutes === 'number') {
      settings.availabilityHeartbeatMinutes = clampPositiveInteger(
        patch.availabilityHeartbeatMinutes,
        settings.availabilityHeartbeatMinutes,
      );
    }

    return { ...settings };
  },
};