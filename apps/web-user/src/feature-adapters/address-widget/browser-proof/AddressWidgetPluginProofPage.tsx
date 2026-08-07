import React from 'react';

export function AddressWidgetPluginProofPage(): JSX.Element {
  const proofRows = [
    ['Plugin', 'address-widget'],
    ['Host contract', 'available'],
    ['Settings contract', 'available'],
    ['Registry consumption', 'proof-only'],
    ['Production replacement', 'not active']
  ];

  return (
    <main data-apex-proof="address-widget-plugin-proof" style={{ padding: 24 }}>
      <h1>Address Widget Plugin Proof</h1>
      <p>This proof page is non-invasive. It does not replace production address UI.</p>
      <section aria-label="Address widget plugin proof status">
        {proofRows.map(([label, value]) => (
          <div key={label} data-proof-row={label}>
            <strong>{label}:</strong> <span>{value}</span>
          </div>
        ))}
      </section>
    </main>
  );
}

export default AddressWidgetPluginProofPage;
