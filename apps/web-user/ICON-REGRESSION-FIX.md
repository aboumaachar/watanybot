# Fatal icon/menu regression — fix from source

Do not commit.

## Root causes

1. PowerShell errors happened because TSX/JSX snippets were pasted into PowerShell. Do not run `function go(path: string)` or `<button ...>` in terminal.
2. Icon problem happened because raster images already include Arabic title inside the image, then code added a second HTML title outside.
3. Click failure means `onClick` was not applied to the real visible button, or an overlay is blocking pointer events.
4. Burger failure means menu state/rendering is missing or overlay/pointer-events blocks it.

## Fix target only

```
apps/web-user/src/components/WatanyRasterCloneHome.tsx
apps/web-user/src/styles/watanyRasterCloneHome.css
```

## Correct icon rule
Until we have art-only icons, use the raster image as the complete visual unit.

No extra label.

```
<button
  type="button"
  className="wr-tile"
  data-route={tile.href}
  onClick={() => go(tile.href)}
>
  <img className="wr-icon-image" src={tile.img} alt={tile.label} />
</button>
```
Remove completely:

```
wr-icon-label
```

## Correct click helpers inside TSX

```
function go(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
```
Burger:

```
<button
  type="button"
  className="wr-menu"
  aria-expanded={menuOpen}
  onClick={() => setMenuOpen(v => !v)}
>
```
Drawer:

```
{menuOpen && (
  <div className="wr-drawer">
    {tiles.map(tile => (
      <button type="button" key={tile.id} onClick={() => go(tile.href)}>
        {tile.label}
      </button>
    ))}
  </div>
)}
```

## CSS anti-overlay

```
.wr-tile,
.wr-menu,
.wr-drawer button {
  pointer-events: auto !important;
  cursor: pointer !important;
  position: relative !important;
  z-index: 20 !important;
}

.wr-grid {
  pointer-events: auto !important;
  z-index: 5 !important;
}

.wr-safe-chat,
.wr-safe-bottom {
  z-index: 10 !important;
}

.wr-icon-image {
  width: 128px !important;
  height: auto !important;
  object-fit: contain !important;
  display: block !important;
}
```

## Validate with browser clicks, not build only

```
pnpm -C apps/web-user typecheck
pnpm -C apps/web-user build
```
Then in browser/Playwright verify:

```
document.querySelector(".wr-menu").click()
!!document.querySelector(".wr-drawer")

document.querySelector(".wr-tile").click()
location.pathname
```
PASS only if:

- no duplicate icon titles
- icons show approved raster look
- first icon click changes route
- burger opens drawer
- drawer buttons navigate
- all chat strings Arabic
