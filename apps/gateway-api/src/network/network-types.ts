export type NetworkVisibilityLevel = 'VISIBLE_PUBLIC' | 'VISIBLE_NETWORK_ONLY' | 'VISIBLE_CAZA_ONLY' | 'VISIBLE_VILLAGE_ONLY' | 'HIDDEN';
export type NetworkApprovalStatus = 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'HIDDEN_BY_ADMIN';
export type NetworkFamilyTier = 'BASIC_FAMILY_MEMBER' | 'VERIFIED_FAMILY_MEMBER' | 'CONTRIBUTOR' | 'COMMUNITY_STEWARD';

export interface NetworkProfileAddress {
  governorateId?: string;
  cazaId?: string;
  municipalityId?: string;
  villageId?: string;
  latitude?: number;
  longitude?: number;
}

export interface NetworkProfile {
  id: string;
  userId: string;
  displayName: string;
  address: NetworkProfileAddress;
  visibilityLevel: NetworkVisibilityLevel;
  familyTier?: NetworkFamilyTier;
  points?: number;
  isVerifiedUser?: boolean;
  approvalStatus: NetworkApprovalStatus;
  isActive: boolean;
  createdAt: string;
  submittedAt?: string;
  approvedAt?: string;
  updatedAt: string;
}

export interface NetworkSettings {
  featureEnabled: boolean;
  requireApproval: boolean;
  defaultVisibilityLevel: NetworkVisibilityLevel;
  gpsEnabled: boolean;
  mapEnabled: boolean;
  connectionsEnabled: boolean;
}