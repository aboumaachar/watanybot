'use client';

import type { WatanyIconAction } from './types';

type Props = {
  actions: WatanyIconAction[];
  ariaLabel?: string;
};

export function ActionIconRow({ actions, ariaLabel = 'إجراءات' }: Props) {
  return (
    <div className="watany-action-row" role="group" aria-label={ariaLabel}>
      {actions.map((action) => {
        const content = (
          <>
            {action.icon ? <span aria-hidden="true">{action.icon}</span> : null}
            <span>{action.label}</span>
          </>
        );
        const style = action.danger ? { color: 'var(--watany-danger)' } : undefined;
        if (action.href) {
          return (
            <a key={action.id} href={action.href} className="watany-action-icon" style={style}>
              {content}
            </a>
          );
        }
        return (
          <button key={action.id} type="button" className="watany-action-icon" onClick={action.onClick} style={style} data-feature-key={action.id}>
            {content}
          </button>
        );
      })}
    </div>
  );
}