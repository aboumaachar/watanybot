
// ADDRESS_NETWORK_CANONICAL_ADDRESS_WIDGET_MIGRATION_REVIEWED
'use client';

import { useState } from 'react';
import { LocationSelector } from '../watany-standard/LocationSelector';
import { WatanyStickyFeatureShell } from '../watany-standard/WatanyStickyFeatureShell';
import type { WatanyLocationValue } from '../watany-standard/types';

export function TaxiDriverAvailabilityPanel() {
  const [available, setAvailable] = useState(false);
  const [location, setLocation] = useState<WatanyLocationValue>({ muhafaza: '', caza: '', village: '' });

  return (
    <WatanyStickyFeatureShell title="لوحة السائق" subtitle="أعلن أنك متاح الآن في منطقة محددة" category="services">
      <div style={{ display: 'grid', gap: 12 }}>
        <section className="watany-card">
          <strong>حالتي الآن</strong>
          <p style={{ color: 'var(--watany-muted)' }}>{available ? 'أنت ظاهر كمُتاح للمستخدمين بعد موافقة الإدارة.' : 'أنت غير ظاهر حالياً للمستخدمين.'}</p>
          <button type="button" className="watany-primary-cta" onClick={() => setAvailable((next) => !next)}>
            {available ? 'إيقاف التوفر' : 'أنا متاح الآن'}
          </button>
        </section>
        <LocationSelector value={location} onChange={setLocation} requireAddress={false} />
        <section className="watany-card">
          <strong>تنبيه</strong>
          <p style={{ color: 'var(--watany-muted)' }}>لن يظهر أي سائق للمستخدمين قبل موافقة الإدارة على الحساب والمستندات.</p>
        </section>
      </div>
    </WatanyStickyFeatureShell>
  );
}

export default TaxiDriverAvailabilityPanel;