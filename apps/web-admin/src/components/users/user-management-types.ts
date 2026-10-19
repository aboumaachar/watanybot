export type ManagedUser = {
  id: string;
  email: string | null;
  name: string;
  role: string;
  status: string;
  phone?: string | null;
  avatar_url?: string | null;
  created_at: string;
  last_login?: string | null;
  last_login_ip?: string | null;
};

export type UsersSummary = {
  total: number;
  active: number;
  suspended: number;
  banned: number;
  logged_today: number;
  never_logged_in: number;
  inactive_30: number;
};

export type UserSession = {
  id: string;
  ip?: string | null;
  user_agent?: string | null;
  created_at: string;
  expires_at: string;
};
export type UserLoginEvent = {
  id: string;
  occurred_at: string;
  client_ip?: string | null;
  peer_ip?: string | null;
  user_agent?: string | null;
  auth_method?: string | null;
  success: boolean;
  failure_reason?: string | null;
};

export type UserAuditEvent = {
  id: string;
  actor_id?: string | null;
  action: string;
  resource: string;
  details?: Record<string, unknown> | null;
  ip?: string | null;
  user_agent?: string | null;
  created_at: string;
};

export type UserFeatureAccess = {
  id: string;
  label: string;
  category: string;
  canDisable: boolean;
  globalEnabled: boolean;
  override: boolean | null;
  effectiveEnabled: boolean;
};

export type UserNetworkProfile = {
  id: string;
  userId: string;
  displayName: string;
  address: {
    governorateId?: string;
    governorateName?: string;
    cazaId?: string;
    cazaName?: string;
    municipalityId?: string;
    municipalityName?: string;
    villageId?: string;
    villageName?: string;
    latitude?: number;
    longitude?: number;
    manualText?: string;
  };
  visibilityLevel: "VISIBLE_PUBLIC" | "VISIBLE_NETWORK_ONLY" | "VISIBLE_CAZA_ONLY" | "VISIBLE_VILLAGE_ONLY" | "HIDDEN";
  familyTier?: "BASIC_FAMILY_MEMBER" | "VERIFIED_FAMILY_MEMBER" | "CONTRIBUTOR" | "COMMUNITY_STEWARD";
  points?: number;
  isVerifiedUser?: boolean;
  approvalStatus: "PENDING" | "APPROVED" | "SUSPENDED" | "HIDDEN_BY_ADMIN";
  isActive: boolean;
  createdAt: string;
  submittedAt?: string;
  approvedAt?: string;
  updatedAt: string;
};

export type UserServicePrivilegeId = "taxi_driver" | "seller" | "employer";
export type UserServicePrivilege = {
  privilege: UserServicePrivilegeId;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
};

export type UserManagementDetail = {
  user: ManagedUser & {
    username?: string | null;
    rank?: string | null;
    military_id?: string | null;
    region?: string | null;
    updated_at?: string | null;
    phone_verified_at?: string | null;
    profile_completed?: boolean | null;
  };
  access: { model: "ROLE_DERIVED"; role: string; capabilities: string[] };
  features: UserFeatureAccess[];
  canManageFeatureOverrides: boolean;
  canManageServicePrivileges: boolean;
  servicePrivileges: UserServicePrivilege[];
  networkProfile: UserNetworkProfile | null;
  canDeleteUser: boolean;
  deleteBlockReason?: string | null;
  sessions: UserSession[];
  loginEvents: UserLoginEvent[];
  auditEvents: UserAuditEvent[];
};

export type BulkPreview = {
  correlationId: string;
  requested: number;
  affected: number;
  blocked: boolean;
  blockReason?: string | null;
  targets?: Array<Pick<ManagedUser, "id" | "name" | "email" | "role" | "status">>;
};

export type ImportRow = {
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  password: string;
};

export type ImportPreview = {
  requested: number;
  valid: number;
  invalid: number;
  skipped: number;
  duplicates: number;
  rows: Array<{
    index: number;
    valid: boolean;
    skipped: boolean;
    duplicate: boolean;
    matchedUserId?: string | null;
    errors: string[];
    user: Omit<ImportRow, "password">;
  }>;
};

export type BulkRequest = {
  ids?: string[];
  filters?: { search?: string; role?: string; status?: string; lastLogin?: string };
  action: "status" | "role" | "revoke_sessions" | "feature" | "delete";
  value?: string;
  featureId?: string;
  featureOverride?: boolean | null;
  confirmDelete?: boolean;
  dryRun: boolean;
};
