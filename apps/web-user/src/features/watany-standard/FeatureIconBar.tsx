'use client';

import type { WatanyIconAction } from './types';

type Props = {
  actions: WatanyIconAction[];
};

export function FeatureIconBar({ actions }: Props) {
  return (
    <nav className="watany-feature-icon-bar" aria-label="روابط الميزة">
      {actions.map((action) => {
        const content = (
          <>
            {action.icon ? <span aria-hidden="true">{action.icon}</span> : null}
            <span>{action.label}</span>
          </>
        );
        if (action.href) {
          return (
            <a key={action.id} className="watany-icon-chip" href={action.href} data-active={action.active ? 'true' : 'false'}>
              {content}
            </a>
          );
        }
        return (
          <button key={action.id} type="button" className="watany-icon-chip" onClick={action.onClick} data-active={action.active ? 'true' : 'false'} data-feature-key={action.id}>
            {content}
          </button>
        );
      })}
    </nav>
  );
}