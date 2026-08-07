import { useState } from 'react';
import { useDistricts, useGovernorates, useLocalities, useLocalitySearch, useMunicipalities } from './provider';

export function UniversalLocator() {
  const governorates = useGovernorates();
  const [governorateId, setGovernorateId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [municipalityId, setMunicipalityId] = useState('');
  const [query, setQuery] = useState('');
  const districts = useDistricts(governorateId || undefined);
  const municipalities = useMunicipalities(districtId || undefined);
  const localities = useLocalities(municipalityId || districtId || undefined);
  const results = useLocalitySearch(query, query ? undefined : 'ar');
  return <div dir="rtl" aria-label="محدد الموقع الإداري">
    <div>
      <label>المحافظة<select value={governorateId} onChange={(event) => { setGovernorateId(event.target.value); setDistrictId(''); setMunicipalityId(''); }}><option value="">اختر المحافظة</option>{governates(governorates)}</select></label>
      <label>القضاء<select value={districtId} onChange={(event) => { setDistrictId(event.target.value); setMunicipalityId(''); }} disabled={!governorateId}><option value="">اختر القضاء</option>{governates(districts)}</select></label>
      <label>البلدية<select value={municipalityId} onChange={(event) => setMunicipalityId(event.target.value)} disabled={!districtId}><option value="">اختر البلدية</option>{governates(municipalities)}</select></label>
    </div>
    <label>ابحث بالعربية أو English أو Français<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="مثال: Beirut" /></label>
    <ul>{(query ? results : localities).slice(0, 20).map((locality) => <li key={locality.id}><button type="button">{locality.nameAr || locality.nameEn || 'اسم غير متحقق'} <small>{locality.nameEn}</small></button></li>)}</ul>
  </div>;
}

function governates(items: readonly { id: string; nameAr: string; nameEn?: string | null }[]) {
  return items.map((item) => <option key={item.id} value={item.id}>{item.nameAr || item.nameEn || 'اسم غير متحقق'}</option>);
}
