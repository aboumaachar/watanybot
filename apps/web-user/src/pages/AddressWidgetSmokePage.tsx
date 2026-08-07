import React, { useState } from 'react';
import { AddressWidget, type AddressWidgetValue } from '@watany/address-network';

export default function AddressWidgetSmokePage() {
  const [value, setValue] = useState<AddressWidgetValue>({});
  const [gpsEnabled, setGpsEnabled] = useState(true);
  const [mapEnabled, setMapEnabled] = useState(true);

  return (
    <main dir="rtl" data-address-widget-smoke-page style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <h1>اختبار عنوان لبنان</h1>
      <p>Smoke page for Muhafaza, Caza, Municipality, Village, GPS, map, manual pin, and defaults.</p>
      <label>
        <input type="checkbox" checked={gpsEnabled} onChange={(event) => setGpsEnabled(event.target.checked)} /> GPS enabled
      </label>
      <label>
        <input type="checkbox" checked={mapEnabled} onChange={(event) => setMapEnabled(event.target.checked)} /> Map enabled
      </label>
      <AddressWidget
        value={value}
        onChange={setValue}
        featureFlags={{ gpsEnabled, mapEnabled, manualPinEnabled: true }}
      />
      <pre data-address-widget-smoke-output>{JSON.stringify(value, null, 2)}</pre>
    </main>
  );
}