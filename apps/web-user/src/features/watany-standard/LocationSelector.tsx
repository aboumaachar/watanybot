
// ADDRESS_NETWORK_LEGACY_COMPATIBILITY_WRAPPER_REVIEWED
'use client';

import { useEffect, useMemo, useState } from 'react';
import { LEBANON_LOCATION_OPTIONS, type WatanyLocationValue } from './types';

type Props = {
  value?: WatanyLocationValue;
  onChange?: (value: WatanyLocationValue) => void;
  requireAddress?: boolean;
};

type LebanonWidgetVillageRecord = {
  muhafaza_name?: string;
  caza_name?: string;
  village_name?: string;
  display_name?: string;
  search?: {
    arabic?: string | null;
  };
};

type LebanonWidgetData = {
  villages?: LebanonWidgetVillageRecord[];
  summary?: {
    village_count?: number;
  };
};

type LocationOptionsShape = typeof LEBANON_LOCATION_OPTIONS;

const LEBANON_WIDGET_DATA_URL = '/vendor/lebanon-admin-widget/data/lebanon_admin_data.json';

const MUHAFAZA_ARABIC_BY_KEY: Record<string, string> = {
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
  akkar: 'عكار',
  baalbek: 'بعلبك',
  chouf: 'الشوف',
  elmetn: 'المتن',
  tyresour: 'صور',
  jbeilbyblos: 'جبيل',
  miniehdinniyeh: 'المنية الضنية',
  keserwan: 'كسروان',
  bintjbeil: 'بنت جبيل',
  baabda: 'بعبدا',
  zahle: 'زحلة',
  nabatieh: 'النبطية',
  aley: 'عاليه',
  batroun: 'البترون',
  marjayoun: 'مرجعيون',
  zgharta: 'زغرتا',
  sidonsaida: 'صيدا',
  jezzine: 'جزين',
  koura: 'الكورة',
  westbeqaa: 'البقاع الغربي',
  hasbaya: 'حاصبيا',
  hermel: 'الهرمل',
  rachaya: 'راشيا',
  bsharri: 'بشري',
  tripoli: 'طرابلس',
};

function normalizeLookupKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, '');
}

function toArabicDistrictName(name: string, dictionary: Record<string, string>): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return '';
  }
  const mapped = dictionary[normalizeLookupKey(trimmed)];
  return mapped || trimmed;
}

function buildLocationOptionsFromWidgetData(payload: LebanonWidgetData): LocationOptionsShape {
  const villages = Array.isArray(payload.villages) ? payload.villages : [];
  const grouped = new Map<string, Map<string, Set<string>>>();

  for (const villageRow of villages) {
    const muhafazaRaw = villageRow.muhafaza_name || '';
    const cazaRaw = villageRow.caza_name || '';
    const villageRaw = (villageRow.search?.arabic || '').trim() || villageRow.village_name || villageRow.display_name || '';
    const muhafaza = toArabicDistrictName(muhafazaRaw, MUHAFAZA_ARABIC_BY_KEY);
    const caza = toArabicDistrictName(cazaRaw, CAZA_ARABIC_BY_KEY);
    const village = villageRaw.trim();

    if (!muhafaza || !caza || !village) {
      continue;
    }

    if (!grouped.has(muhafaza)) {
      grouped.set(muhafaza, new Map<string, Set<string>>());
    }
    const cazaMap = grouped.get(muhafaza)!;
    if (!cazaMap.has(caza)) {
      cazaMap.set(caza, new Set<string>());
    }
    cazaMap.get(caza)!.add(village);
  }

  if (grouped.size === 0) {
    return LEBANON_LOCATION_OPTIONS;
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'ar'))
    .map(([muhafaza, cazaMap]) => ({
      muhafaza,
      cazas: [...cazaMap.entries()]
        .sort(([left], [right]) => left.localeCompare(right, 'ar'))
        .map(([caza, villageSet]) => ({
          caza,
          villages: [...villageSet].sort((left, right) => left.localeCompare(right, 'ar')),
        })),
    }));
}

export function LocationSelector({ value, onChange, requireAddress = false }: Readonly<Props>) {
  const [locationOptions, setLocationOptions] = useState<LocationOptionsShape>(LEBANON_LOCATION_OPTIONS);
  const [muhafaza, setMuhafaza] = useState(value?.muhafaza ?? '');
  const [caza, setCaza] = useState(value?.caza ?? '');
  const [village, setVillage] = useState(value?.village ?? '');
  const [address, setAddress] = useState(value?.address ?? '');

  useEffect(() => {
    let cancelled = false;

    async function loadWidgetLocations() {
      try {
        const response = await fetch(LEBANON_WIDGET_DATA_URL);
        if (!response.ok) {
          throw new Error(`LEBANON_WIDGET_DATA_FETCH_${response.status}`);
        }
        const payload = await response.json() as LebanonWidgetData;
        const hasExpectedScale = Number(payload.summary?.village_count || 0) >= 1586;
        const nextOptions = buildLocationOptionsFromWidgetData(payload);
        if (!cancelled && hasExpectedScale && nextOptions.length > 0) {
          setLocationOptions(nextOptions);
        }
      } catch {
        if (!cancelled) {
          setLocationOptions(LEBANON_LOCATION_OPTIONS);
        }
      }
    }

    void loadWidgetLocations();
    return () => {
      cancelled = true;
    };
  }, []);

  const cazaOptions = useMemo(() => locationOptions.find((item) => item.muhafaza === muhafaza)?.cazas ?? [], [locationOptions, muhafaza]);
  const villageOptions = useMemo(() => cazaOptions.find((item) => item.caza === caza)?.villages ?? [], [cazaOptions, caza]);

  function emit(next: Partial<WatanyLocationValue>) {
    const merged = { muhafaza, caza, village, address, ...next };
    onChange?.(merged);
  }

  return (
    <div className="watany-card" style={{ display: 'grid', gap: 10 }}>
      <label>
        <span>المحافظة</span>
        <select className="watany-select" value={muhafaza} onChange={(event) => { const next = event.target.value; setMuhafaza(next); setCaza(''); setVillage(''); emit({ muhafaza: next, caza: '', village: '' }); }}>
          <option value="">اختر المحافظة</option>
          {locationOptions.map((item) => <option key={item.muhafaza} value={item.muhafaza}>{item.muhafaza}</option>)}
        </select>
      </label>
      <label>
        <span>القضاء</span>
        <select className="watany-select" value={caza} onChange={(event) => { const next = event.target.value; setCaza(next); setVillage(''); emit({ caza: next, village: '' }); }} disabled={!muhafaza}>
          <option value="">اختر القضاء</option>
          {cazaOptions.map((item) => <option key={item.caza} value={item.caza}>{item.caza}</option>)}
        </select>
      </label>
      <label>
        <span>البلدة / القرية</span>
        <select className="watany-select" value={village} onChange={(event) => { const next = event.target.value; setVillage(next); emit({ village: next }); }} disabled={!caza}>
          <option value="">اختر البلدة</option>
          {villageOptions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      {requireAddress ? (
        <label>
          <span>العنوان التفصيلي</span>
          <input data-aided-input-optional-exact-address="true" className="watany-input" value={address} onChange={(event) => { const next = event.target.value; setAddress(next); emit({ address: next }); }} placeholder="مثال: قرب البلدية، الطابق الأول..." />
        </label>
      ) : null}
    </div>
  );
}