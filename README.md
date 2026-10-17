# WorldCC - Elegant World Clock

An elegant world clock application with Apple-style design aesthetics.

## Features
- Beautiful starfield background with twinkling stars
- Main clock with date display
- Three world clocks with timezone selection
- 12/24 hour format toggle
- Light/Dark theme support
- Fullscreen mode (double-click to toggle)
- Local storage for user preferences
- Responsive design

## Tech Stack
- Pure HTML/CSS/JavaScript
- Native Intl.DateTimeFormat for timezone handling

## Development and regression tests

The clocks use the browser's `Intl.DateTimeFormat` timezone rules. Keep the
browser/OS up to date when governments change their timezone rules. No external
JavaScript libraries are needed by the page. Browsers without
`Intl.supportedValuesOf('timeZone')` get a curated timezone menu; valid saved
aliases are retained in either menu.

Use a static server for development, for example `python3 -m http.server 4173`,
then open http://localhost:4173.

- `npm test`: Node.js 20+ behavior tests for timezone changes/DST, 12/24-hour
  formatting, malformed/blocked storage, saved aliases, themes, security config,
  plus source-level layout/style safeguards. No npm install is needed for these.
- `npm ci && npx playwright install chromium`: install the optional browser-test
  tools and browser from the official Playwright package.
- `npm run test:browser`: actual page tests with deterministic time, malformed
  storage, blocked third parties, CSP/CC effect, and 671×374, 400×639, 1280×800
  viewports. To use an existing compatible Chromium installation, set
  `CHROMIUM_PATH=/path/to/chromium`.
- `npm run test:all`: both suites. The browser suite requires an environment that
  permits Chromium processes and localhost sockets.

The test server serves the headers in `vercel.json`, but it is not a Vercel
routing emulator. After a deployment, verify the actual response headers,
JavaScript/CSS MIME types, and browser console on the deployed URL as well.

## Security headers

`vercel.json` sets CSP, `X-Content-Type-Options`, `Referrer-Policy`, and frame
protection. The CSP allows only first-party app scripts plus the existing
Cloudflare Web Analytics script at `static.cloudflareinsights.com`. The current
injected script configuration uses the same-origin `/cdn-cgi/rum` beacon route,
so `connect-src` is limited to the same origin. This does not add an analytics
script or new data collection. The existing CC effect and theme set
individual CSS properties, which remain allowed by CSP. Inline script/style
blocks, inline style attributes, and eval are not allowed.

References: [Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat),
[Cloudflare Web Analytics endpoints](https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/),
[Vercel static configuration](https://vercel.com/docs/project-configuration/vercel-json).
