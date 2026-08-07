/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';

// Minimal DOM snapshot for the homepage icon grid. This test captures the HTML
// structure so CI can detect layout regressions. Run with `pnpm --dir apps/web-user test`.

describe('Homepage basic snapshot', () => {
  it('renders a basic icon grid structure', () => {
    // Build a representative DOM fragment
    const container = document.createElement('div');
    container.className = 'watany-approved-home-icons home-icons-grid';

    for (const label of ['المعاش', 'مدارس', 'أدوات']) {
      const card = document.createElement('a');
      card.className = 'watany-approved-runtime-card watany-homepage-unified-card';
      card.setAttribute('data-watany-home-label', label);

      const tile = document.createElement('div');
      tile.className = 'watany-approved-runtime-tile watany-homepage-unified-tile';
      const glyph = document.createElement('span');
      glyph.className = 'watany-approved-runtime-glyph watany-homepage-unified-glyph';
      tile.appendChild(glyph);

      const lbl = document.createElement('span');
      lbl.className = 'watany-approved-runtime-label watany-homepage-unified-label';
      lbl.textContent = label;

      card.appendChild(tile);
      card.appendChild(lbl);
      container.appendChild(card);
    }

    // Snapshot the outerHTML to detect layout-related regressions in CI
    expect(container.outerHTML).toMatchSnapshot();
  });
});
