# Demo 01 route snippet

This script did not modify global theme, styling, palette, CSS, or icon-system files.

If automatic route registration was not possible, manually add the page route in your active router file:

```tsx
import KoudamaDemo01AllIconsLayoutPage from './pages/KoudamaDemo01AllIconsLayoutPage';

<Route path="/koudama/demo-01-all-icons-layout" element={<KoudamaDemo01AllIconsLayoutPage />} />
```

If your router is object-based, add an equivalent route entry pointing to:

```tsx
KoudamaDemo01AllIconsLayoutPage
```

World Cup remains ready/locked/excluded. This layout only displays it visually as a locked entertainment item.