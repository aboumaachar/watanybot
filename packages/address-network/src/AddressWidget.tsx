import React, { useEffect, useMemo, useState } from 'react';
import './AddressWidget.css';
import { CAZAS, GOVERNORATES, VILLAGES, defaultAddressFeatureFlags } from './address-data';
import type {
  AddressValue as AddressValueModel,
  AddressWidgetFeatureFlags,
} from './address-types';

export type AddressWidgetValue = AddressValueModel;
export type AddressValue = AddressValueModel;
export type { AddressWidgetFeatureFlags };

type AdminVillageRecord = {
  id?: string;
  muhafaza_name?: string;
  caza_name?: string;
  village_name?: string;
  display_name?: string;
  search?: {
    arabic?: string | null;
    latin?: string | null;
  };
};

type AdminWidgetData = {
  villages?: AdminVillageRecord[];
  summary?: {
    muhafaza_count?: number;
    caza_count?: number;
    village_count?: number;
  };
};

type AddressRow = {
  id: string;
  governorateId?: string;
  cazaId?: string;
  municipalityId?: string;
  nameAr: string;
  nameEn: string;
  enabled: boolean;
  latitude?: number;
  longitude?: number;
};

type AddressCatalog = {
  governorates: AddressRow[];
  cazas: AddressRow[];
  villages: AddressRow[];
  sourceLabel: string;
  governorateCount: number;
  cazaCount: number;
  villageCount: number;
};

export type AddressWidgetProps = {
  value?: AddressValueModel;
  onChange?: (value: AddressValueModel) => void;
  defaults?: AddressValueModel;
  featureFlags?: AddressWidgetFeatureFlags;
  labels?: {
    governorate?: string;
    caza?: string;
    municipality?: string;
    village?: string;
    gps?: string;
    map?: string;
  };
};

function toNumber(value: string): number | undefined {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatCoordinate(value?: number): string {
  return typeof value === 'number' ? String(value) : '';
}

function normalizeLookupKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, '');
}

const GOVERNORATE_ARABIC_BY_KEY: Record<string, string> = {
  beirut: 'بيروت',
  mountlebanon: 'جبل لبنان',
  north: 'الشمال',
  akkar: 'عكار',
  bekaa: 'البقاع',
  baalbekhermel: 'بعلبك الهرمل',
  south: 'الجنوب',
  nabatieh: 'النبطية',
};

const CAZA_ARABIC_BY_KEY: Record<string, string> = {
  beirut: 'بيروت',
  akkar: 'عكار',
  baabda: 'بعبدا',
  metn: 'المتن',
  keserwan: 'كسروان',
  jbeil: 'جبيل',
  jbeilbyblos: 'جبيل',
  tripoli: 'طرابلس',
  koura: 'الكورة',
  zgharta: 'زغرتا',
  batroun: 'البترون',
  bsharri: 'بشري',
  aliyah: 'عاليه',
  aley: 'عاليه',
  chouf: 'الشوف',
  zahle: 'زحلة',
  westbeqaa: 'البقاع الغربي',
  beqaa: 'البقاع',
  baalbek: 'بعلبك',
  hermel: 'الهرمل',
  saida: 'صيدا',
  tyresour: 'صور',
  jezzine: 'جزين',
  bintjbeil: 'بنت جبيل',
  marjayoun: 'مرجعيون',
  hasbaya: 'حاصبيا',
  nabatieh: 'النبطية',
  miniehdinniyeh: 'المنية الضنية',
};

function toArabicName(name: string, dictionary: Record<string, string>): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return '';
  }
  return dictionary[normalizeLookupKey(trimmed)] || trimmed;
}

function toStableId(label: string, fallbackPrefix: string): string {
  const normalized = normalizeLookupKey(label);
  return normalized ? `${fallbackPrefix}-${normalized}` : `${fallbackPrefix}-unknown`;
}

function buildSeedCatalog(): AddressCatalog {
  return {
    governorates: GOVERNORATES.map((row) => ({
      id: row.id,
      nameAr: row.nameAr,
      nameEn: row.nameEn,
      enabled: row.enabled,
    })),
    cazas: CAZAS.map((row) => ({
      id: row.id,
      governorateId: row.governorateId,
      nameAr: row.nameAr,
      nameEn: row.nameEn,
      enabled: row.enabled,
    })),
    villages: VILLAGES.map((row) => ({
      id: row.id,
      governorateId: row.governorateId,
      cazaId: row.cazaId,
      municipalityId: row.municipalityId,
      nameAr: row.nameAr,
      nameEn: row.nameEn,
      enabled: row.enabled,
      latitude: row.latitude,
      longitude: row.longitude,
    })),
    sourceLabel: 'نسخة احتياطية',
    governorateCount: GOVERNORATES.length,
    cazaCount: CAZAS.length,
    villageCount: VILLAGES.length,
  };
}

function buildAdminCatalog(payload: AdminWidgetData): AddressCatalog {
  const villages = Array.isArray(payload.villages) ? payload.villages : [];
  const governorateMap = new Map<string, AddressRow>();
  const cazaMap = new Map<string, AddressRow>();
  const villageMap = new Map<string, AddressRow>();

  for (const row of villages) {
    const governorateNameEn = (row.muhafaza_name || '').trim();
    const cazaNameEn = (row.caza_name || '').trim();
    const villageName = (row.search?.arabic || '').trim() || (row.display_name || row.village_name || '').trim();

    if (!governorateNameEn || !cazaNameEn || !villageName) {
      continue;
    }

    const governorateNameAr = toArabicName(governorateNameEn, GOVERNORATE_ARABIC_BY_KEY);
    const cazaNameAr = toArabicName(cazaNameEn, CAZA_ARABIC_BY_KEY);
    const governorateId = GOVERNORATE_BY_NAME.get(normalizeLookupKey(governorateNameAr)) || toStableId(governorateNameAr, 'gov');
    const cazaId = CAZA_BY_NAME.get(normalizeLookupKey(cazaNameAr)) || toStableId(cazaNameAr, governorateId);
    const villageId = (row.id || '').trim() || `${cazaId}-${normalizeLookupKey(villageName)}`;

    if (!governorateMap.has(governorateId)) {
      governorateMap.set(governorateId, {
        id: governorateId,
        nameAr: governorateNameAr,
        nameEn: governorateNameEn,
        enabled: true,
      });
    }

    if (!cazaMap.has(cazaId)) {
      cazaMap.set(cazaId, {
        id: cazaId,
        governorateId,
        nameAr: cazaNameAr,
        nameEn: cazaNameEn,
        enabled: true,
      });
    }

    if (!villageMap.has(villageId)) {
      villageMap.set(villageId, {
        id: villageId,
        governorateId,
        cazaId,
        municipalityId: cazaId,
        nameAr: villageName,
        nameEn: row.display_name || row.village_name || villageName,
        enabled: true,
      });
    }
  }

  if (governorateMap.size === 0 || cazaMap.size === 0 || villageMap.size === 0) {
    return buildSeedCatalog();
  }

  return {
    governorates: [...governorateMap.values()].sort((left, right) => left.nameAr.localeCompare(right.nameAr, 'ar')),
    cazas: [...cazaMap.values()].sort((left, right) => left.nameAr.localeCompare(right.nameAr, 'ar')),
    villages: [...villageMap.values()].sort((left, right) => left.nameAr.localeCompare(right.nameAr, 'ar')),
    sourceLabel: 'البيانات الإدارية الكاملة',
    governorateCount: Number(payload.summary?.muhafaza_count || governorateMap.size),
    cazaCount: Number(payload.summary?.caza_count || cazaMap.size),
    villageCount: Number(payload.summary?.village_count || villageMap.size),
  };
}

const GOVERNORATE_BY_NAME = new Map<string, string>([
  ['بيروت', 'BEY'],
  ['beirut', 'BEY'],
  ['جبل لبنان', 'MLB'],
  ['mountlebanon', 'MLB'],
  ['الشمال', 'NLB'],
  ['north', 'NLB'],
  ['عكار', 'AKK'],
  ['akkar', 'AKK'],
  ['البقاع', 'BEQ'],
  ['bekaa', 'BEQ'],
  ['بعلبك الهرمل', 'BHB'],
  ['baalbekhermel', 'BHB'],
  ['الجنوب', 'SLB'],
  ['south', 'SLB'],
  ['النبطية', 'NAB'],
  ['nabatieh', 'NAB'],
]);

const CAZA_BY_NAME = new Map<string, string>([
  ['بيروت', 'BEY-BEY'],
  ['beirut', 'BEY-BEY'],
  ['كسروان', 'MLB-KES'],
  ['keserwan', 'MLB-KES'],
  ['عكار', 'AKK-AKKAR'],
  ['akkar', 'AKK-AKKAR'],
  ['المتن', 'MLB-METN'],
  ['metn', 'MLB-METN'],
  ['بعبدا', 'MLB-BAABDA'],
  ['baabda', 'MLB-BAABDA'],
  ['جبل لبنان', 'MLB-MOUNTLEBANON'],
  ['mountlebanon', 'MLB-MOUNTLEBANON'],
  ['طرابلس', 'NLB-TRIPOLI'],
  ['tripoli', 'NLB-TRIPOLI'],
  ['زحلة', 'BEQ-ZAHLE'],
  ['zahle', 'BEQ-ZAHLE'],
  ['البقاع الغربي', 'BEQ-WESTBEQAA'],
  ['westbeqaa', 'BEQ-WESTBEQAA'],
  ['صيدا', 'SLB-SAIDA'],
  ['saida', 'SLB-SAIDA'],
  ['النبطية', 'NAB-NABATIEH'],
  ['nabatieh', 'NAB-NABATIEH'],
  ['جبيل', 'MLB-JBEIL'],
  ['jbeil', 'MLB-JBEIL'],
  ['البترون', 'NLB-BATROUN'],
  ['batroun', 'NLB-BATROUN'],
  ['زغرتا', 'NLB-ZGHARTA'],
  ['zgharta', 'NLB-ZGHARTA'],
]);

const FULL_DATA_URL = '/vendor/lebanon-admin-widget/data/lebanon_admin_data.json';

export function AddressWidget(props: Readonly<AddressWidgetProps>) {
  const labels = props.labels
    ? {
        governorate: 'المحافظة',
        caza: 'القضاء',
        municipality: 'البلدية',
        village: 'البلدة / القرية',
        gps: 'تحديد موقعي',
        map: 'تحديد على الخريطة',
        ...props.labels,
      }
    : {
        governorate: 'المحافظة',
        caza: 'القضاء',
        municipality: 'البلدية',
        village: 'البلدة / القرية',
        gps: 'تحديد موقعي',
        map: 'تحديد على الخريطة',
      };

  const featureFlags = props.featureFlags
    ? {
        gpsEnabled: defaultAddressFeatureFlags.gpsEnabledByDefault,
        mapEnabled: defaultAddressFeatureFlags.mapPinEnabledByDefault,
        manualPinEnabled: defaultAddressFeatureFlags.manualAddressAllowed,
        ...props.featureFlags,
      }
    : {
        gpsEnabled: defaultAddressFeatureFlags.gpsEnabledByDefault,
        mapEnabled: defaultAddressFeatureFlags.mapPinEnabledByDefault,
        manualPinEnabled: defaultAddressFeatureFlags.manualAddressAllowed,
      };

  const [internalValue, setInternalValue] = useState<AddressWidgetValue>(() => {
    if (props.defaults && props.value) {
      return { ...props.defaults, ...props.value };
    }

    if (props.defaults) {
      return { ...props.defaults };
    }

    if (props.value) {
      return { ...props.value };
    }

    return {};
  });
  const value = props.value || internalValue;
  const [latitudeText, setLatitudeText] = useState(() => formatCoordinate(value.latitude));
  const [longitudeText, setLongitudeText] = useState(() => formatCoordinate(value.longitude));
  const [catalog, setCatalog] = useState<AddressCatalog>(() => buildSeedCatalog());

  useEffect(() => {
    setLatitudeText(formatCoordinate(value.latitude));
  }, [value.latitude]);

  useEffect(() => {
    setLongitudeText(formatCoordinate(value.longitude));
  }, [value.longitude]);

  useEffect(() => {
    let cancelled = false;

    async function loadFullCatalog() {
      try {
        const response = await fetch(FULL_DATA_URL);
        if (!response.ok) {
          throw new Error(`ADDRESS_WIDGET_FULL_DATA_FETCH_${response.status}`);
        }

        const payload = await response.json() as AdminWidgetData;
        if (!cancelled) {
          const villageCount = Number(payload.summary?.village_count || 0);
          if (villageCount >= 1500 && Array.isArray(payload.villages) && payload.villages.length > 0) {
            setCatalog(buildAdminCatalog(payload));
          }
        }
      } catch {
        if (!cancelled) {
          setCatalog(buildSeedCatalog());
        }
      }
    }

    void loadFullCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  const governorates = catalog.governorates;

  const cazas = useMemo(() => {
    return catalog.cazas.filter((row) => !value.governorateId || row.governorateId === value.governorateId);
  }, [catalog.cazas, value.governorateId]);

  const villages = useMemo(() => {
    return catalog.villages.filter((row) => {
      if (value.municipalityId && row.municipalityId !== value.municipalityId) return false;
      if (!value.municipalityId && value.cazaId && row.cazaId !== value.cazaId) return false;
      return true;
    });
  }, [catalog.villages, value.cazaId, value.municipalityId]);

  function emit(next: AddressWidgetValue) {
    setInternalValue(next);
    if (props.onChange) props.onChange(next);
  }

  function selectGovernorate(governorateId: string) {
    const row = governorates.find((item) => item.id === governorateId);
    emit({
      ...value,
      governorateId,
      governorateName: row?.nameAr || row?.nameEn || '',
      cazaId: '',
      cazaName: '',
      municipalityId: '',
      municipalityName: '',
      villageId: '',
      villageName: '',
      latitude: undefined,
      longitude: undefined,
      manualPin: false
    });
  }

  function selectCaza(cazaId: string) {
    const row = cazas.find((item) => item.id === cazaId);
    emit({
      ...value,
      cazaId,
      cazaName: row?.nameAr || row?.nameEn || '',
      municipalityId: cazaId,
      municipalityName: row?.nameAr || row?.nameEn || '',
      villageId: '',
      villageName: '',
      latitude: undefined,
      longitude: undefined,
      manualPin: false
    });
  }

  function selectMunicipality(municipalityId: string) {
    emit({
      ...value,
      municipalityId,
      municipalityName: value.cazaName || value.municipalityName || '',
      villageId: '',
      villageName: '',
      latitude: undefined,
      longitude: undefined,
      manualPin: false
    });
  }

  function selectVillage(villageId: string) {
    const row = villages.find((item) => item.id === villageId);
    emit({
      ...value,
      villageId,
      villageName: row?.nameAr || row?.nameEn || '',
      municipalityId: value.cazaId || value.municipalityId,
      municipalityName: value.cazaName || value.municipalityName,
      latitude: typeof row?.latitude === 'number' ? row.latitude : value.latitude,
      longitude: typeof row?.longitude === 'number' ? row.longitude : value.longitude,
      manualPin: false
    });
  }

  function captureGps() {
    if (!featureFlags.gpsEnabled || typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => {
      emit({
        ...value,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        manualPin: false
      });
    });
  }

  function setManualPin(latitudeText: string, longitudeText: string) {
    if (!featureFlags.mapEnabled || !featureFlags.manualPinEnabled) return;
    emit({
      ...value,
      latitude: toNumber(latitudeText),
      longitude: toNumber(longitudeText),
      manualPin: true
    });
  }

  return (
    <section className="watany-address-widget" data-address-widget="canonical" dir="rtl">
      <header className="watany-address-widget__header">
        <div>
          <strong>تحديد العنوان</strong>
          <span>اختر المحافظة ثم القضاء ثم البلدة / القرية، وسيُستكمل التجميع الإداري تلقائياً.</span>
        </div>
        <div className="watany-address-widget__summary" aria-label="إحصاءات بيانات العنوان">
          <span className="watany-address-widget__chip">{catalog.sourceLabel}</span>
          <span className="watany-address-widget__chip">المحافظات {catalog.governorateCount}</span>
          <span className="watany-address-widget__chip">الأقضية {catalog.cazaCount}</span>
          <span className="watany-address-widget__chip">القرى {catalog.villageCount}</span>
        </div>
      </header>

      <div className="watany-address-widget__grid" data-cascade-order="mohafaza-caza-village-exact-address">
        <label className="watany-address-widget__field">
          <span>{labels.governorate}</span>
          <select data-address-governorate value={value.governorateId || ''} onChange={(event) => selectGovernorate(event.target.value)}>
            <option value="">اختر المحافظة</option>
            {governorates.map((row) => <option key={row.id} value={row.id}>{row.nameAr || row.nameEn}</option>)}
          </select>
        </label>

        <label className="watany-address-widget__field">
          <span>{labels.caza}</span>
          <select data-address-caza value={value.cazaId || ''} onChange={(event) => selectCaza(event.target.value)} disabled={!value.governorateId}>
            <option value="">اختر القضاء</option>
            {cazas.map((row) => <option key={row.id} value={row.id}>{row.nameAr || row.nameEn}</option>)}
          </select>
        </label>

        <div className="watany-address-widget__derived" data-address-municipality-summary>
          <span>البلدية</span>
          <strong>{value.cazaName || 'تُستكمل تلقائياً من القضاء المختار'}</strong>
        </div>

        <label className="watany-address-widget__field watany-address-widget__field--wide">
          <span>{labels.village}</span>
          <select data-address-village value={value.villageId || ''} onChange={(event) => selectVillage(event.target.value)} disabled={!value.cazaId}>
            <option value="">اختر البلدة / القرية</option>
            {villages.map((row) => <option key={row.id} value={row.id}>{row.nameAr || row.nameEn}</option>)}
          </select>
        </label>

        {featureFlags.gpsEnabled ? (
          <button type="button" data-address-gps onClick={captureGps}>{labels.gps}</button>
        ) : null}

      {featureFlags.mapEnabled ? (
        <div className="watany-address-widget__manual-pin" data-address-map="manual-pin">
          <span>{labels.map}</span>
          <input
            data-address-latitude
            inputMode="decimal"
            placeholder="latitude"
            value={latitudeText}
            onChange={(event) => setLatitudeText(event.target.value)}
            disabled={!featureFlags.manualPinEnabled}
          />
          <input
            data-address-longitude
            inputMode="decimal"
            placeholder="longitude"
            value={longitudeText}
            onChange={(event) => setLongitudeText(event.target.value)}
            disabled={!featureFlags.manualPinEnabled}
          />
          <button
            type="button"
            data-address-manual-pin
            disabled={!featureFlags.manualPinEnabled}
            onClick={() => setManualPin(latitudeText, longitudeText)}
          >
            حفظ النقطة
          </button>
        </div>
      ) : null}
      </div>
    </section>
  );
}

export default AddressWidget;