import React from 'react';
import { WatanyIconSignV2, type WatanyIconKey } from './watanyIconSystemV2';

export default function WatanyIconSystemV2Preview(): JSX.Element {
  const keys: WatanyIconKey[] = [
    'apps-grid',
    'wallet-money',
    'graduation-cap',
    'clipboard-check',
    'briefcase',
    'store',
    'network-nodes',
    'people-group',
    'chat-bubble',
    'gear',
    'document-file',
    'law-book',
    'announcement',
    'notice-ribbon',
    'ballot',
    'user-profile',
    'help-guide',
    'default',
  ];

  return (
    <main dir="rtl" style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #fffdf8 0%, #f4f7fb 100%)', padding: 24 }}>
      <h1 style={{ color: '#173b2c', textAlign: 'center', fontWeight: 800, margin: '0 0 8px' }}>Watany Icon System V2 Preview</h1>
      <p style={{ color: '#425466', textAlign: 'center', margin: '0 0 24px' }}>Approved local SVG icon registry</p>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))', maxWidth: 1040, margin: '0 auto' }}>
        {keys.map((k) => (
          <div key={k} className="watany-icon-card-v2" style={{ background: '#ffffff', borderRadius: 20, padding: 16, boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)', textAlign: 'center' }}>
            <div style={{ width: 84, height: 84, margin: '0 auto 12px', borderRadius: 22, display: 'grid', placeItems: 'center', background: 'linear-gradient(145deg, #0d2b25 0%, #0f6a4d 58%, #d7a640 100%)', color: '#f8fafc' }}>
              <WatanyIconSignV2 name={k} />
            </div>
            <div style={{ color: '#173b2c', fontWeight: 700, fontSize: 13, lineHeight: 1.35 }}>{k}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
