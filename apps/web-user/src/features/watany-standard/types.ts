export type WatanyFeatureCategory = 'personal' | 'informational' | 'services' | 'community' | 'admin';

export type WatanyIconAction = {
  id: string;
  label: string;
  icon?: string;
  href?: string;
  active?: boolean;
  danger?: boolean;
  onClick?: () => void;
};

export type WatanyLocationValue = {
  muhafaza: string;
  caza: string;
  village: string;
  address?: string;
};

export const WATANY_CATEGORY_META: Record<WatanyFeatureCategory, { labelAr: string; colorVar: string }> = {
  personal: { labelAr: 'شخصي', colorVar: 'var(--watany-personal)' },
  informational: { labelAr: 'معلومات', colorVar: 'var(--watany-info)' },
  services: { labelAr: 'خدمات', colorVar: 'var(--watany-services)' },
  community: { labelAr: 'مجتمع', colorVar: 'var(--watany-community)' },
  admin: { labelAr: 'إدارة', colorVar: 'var(--watany-admin)' },
};

export const LEBANON_LOCATION_OPTIONS = [
  { muhafaza: 'بيروت', cazas: [{ caza: 'بيروت', villages: ['بيروت'] }] },
  { muhafaza: 'جبل لبنان', cazas: [
    { caza: 'بعبدا', villages: ['بعبدا', 'الحدث', 'الشياح'] },
    { caza: 'المتن', villages: ['جديدة المتن', 'برج حمود', 'الدكوانة'] },
    { caza: 'كسروان', villages: ['جونية', 'ذوق مكايل', 'غزير'] },
    { caza: 'جبيل', villages: ['جبيل', 'عمشيت', 'حالات'] },
    { caza: 'عاليه', villages: ['عاليه', 'الشويفات', 'بحمدون'] },
    { caza: 'الشوف', villages: ['بيت الدين', 'دير القمر', 'برجا'] },
  ] },
  { muhafaza: 'الشمال', cazas: [
    { caza: 'طرابلس', villages: ['طرابلس', 'الميناء'] },
    { caza: 'الكورة', villages: ['أميون', 'كفرحزير'] },
    { caza: 'زغرتا', villages: ['زغرتا', 'إهدن'] },
    { caza: 'البترون', villages: ['البترون', 'تنورين'] },
    { caza: 'بشري', villages: ['بشري'] },
  ] },
  { muhafaza: 'عكار', cazas: [{ caza: 'عكار', villages: ['حلبا', 'القبيات', 'برقايل'] }] },
  { muhafaza: 'البقاع', cazas: [
    { caza: 'زحلة', villages: ['زحلة', 'تعلبايا'] },
    { caza: 'البقاع الغربي', villages: ['جب جنين', 'صغبين'] },
    { caza: 'راشيا', villages: ['راشيا'] },
  ] },
  { muhafaza: 'بعلبك الهرمل', cazas: [
    { caza: 'بعلبك', villages: ['بعلبك', 'دورس'] },
    { caza: 'الهرمل', villages: ['الهرمل'] },
  ] },
  { muhafaza: 'الجنوب', cazas: [
    { caza: 'صيدا', villages: ['صيدا', 'الهلالية'] },
    { caza: 'صور', villages: ['صور', 'العباسية'] },
    { caza: 'جزين', villages: ['جزين'] },
  ] },
  { muhafaza: 'النبطية', cazas: [
    { caza: 'النبطية', villages: ['النبطية', 'كفررمان'] },
    { caza: 'بنت جبيل', villages: ['بنت جبيل'] },
    { caza: 'مرجعيون', villages: ['مرجعيون', 'الخيام'] },
    { caza: 'حاصبيا', villages: ['حاصبيا'] },
  ] },
];