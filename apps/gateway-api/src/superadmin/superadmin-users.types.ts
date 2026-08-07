export type UserStatus = "ACTIVE" | "SUSPENDED" | "BANNED" | "PENDING" | "DELETED";
export type UserRoleName = "USER" | "ADMIN" | "SUPERADMIN" | string;

export type SuperadminUserRow = {
  id: string;
  displayName: string;
  username?: string;
  email?: string;
  phone?: string;
  roles: UserRoleName[];
  status: UserStatus;
  birthDate?: string;
  birthdayLabel?: string;
  lastSeenAt?: string;
  isActiveNow: boolean;
  lastKnownIp?: string;
  registrationIp?: string;
  ipCount?: number;
  createdAt?: string;
  notes?: string;
};

export type ActiveUsersSummary = {
  activeNow: number;
  activeLast15Minutes: number;
  activeToday: number;
  generatedAt: string;
};

export type BirthdaySummary = {
  today: SuperadminUserRow[];
  upcoming: SuperadminUserRow[];
  generatedAt: string;
};

export type SuperadminUsersDashboard = {
  users: SuperadminUserRow[];
  activeUsers: ActiveUsersSummary;
  birthdays: BirthdaySummary;
  totalUsers: number;
  filters: {
    q?: string;
    status?: string;
    role?: string;
  };
};

export type IpAuditRecord = {
  userId?: string;
  ipAddress: string;
  userAgent?: string;
  route?: string;
  method?: string;
  capturedAt: string;
  source: "x-forwarded-for" | "x-real-ip" | "req-ip" | "socket";
};
