# Responsive And Accessibility

Fresh authenticated evidence is recorded in `machine/responsive-results.json`. Five canonical screenshots are present under `machine/screenshots/`, and the controlled standalone Playwright run used exactly 430x932 with no document or body horizontal overflow. Desktop and tablet detail states prove `.admin-content` has `min-width: 0`, the table is wider than its wrapper, and the wrapper owns horizontal scrolling.

The final controlled drawer state measured 398px wide with its right edge at 414px, retained a 430px document width, exposed `role=dialog` and `aria-modal=true`, rendered immutable history, and passed keyboard focus traversal plus the explicit accessible close control.

`REQUIRED_SCREENSHOT_COUNT=5`
`BODY_HORIZONTAL_OVERFLOW_COUNT=0` for the initial 430x932 list state
`AIN_TABLE_MOBILE_USABLE=PASS` wrapper owns horizontal scroll
`AIN_DETAIL_MOBILE_USABLE=PASS` drawer remained contained at 430x932
`AIN_HISTORY_MOBILE_USABLE=PASS` immutable history rendered in the authenticated drawer
`AIN_ACCESSIBILITY=PASS`
