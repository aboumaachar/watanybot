export type SmartDashboardCard = {
  feature_key: string;
  title_ar: string;
  route: string;
  icon_key?: string;
  group_ar?: string;
  score?: number;
  reason_label?: string;
  is_critical?: boolean;
  dismissable?: boolean;
};

export type SmartDashboardResponse = {
  personalization_active: boolean;
  critical_zone?: SmartDashboardCard[];
  personalized_zone?: SmartDashboardCard[];
  default_zone?: SmartDashboardCard[];
  all_services_link?: string;
  direction?: 'rtl';
};

export type SmartDashboardLoadState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; data: SmartDashboardResponse }
  | { status: 'auth-gated'; statusCode: 401 | 403 }
  | { status: 'db-not-configured'; statusCode: 503 }
  | { status: 'unavailable'; statusCode?: number; message?: string };
