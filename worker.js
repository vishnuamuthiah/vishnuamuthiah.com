// OptionsVision's Privacy Policy, Terms of Use and Financial Disclaimer,
// generated from the app's own LegalView.swift by tools/extract-legal.py so the
// two can't drift. Regenerate after editing the Swift, never edit the JS.
import { LEGAL_DOCS, LEGAL_INFO, LEGAL_FINE_PRINT } from './legal-content.js';

// The share-link fallback page, served at optionsvision.app/p/<payload>. Synced
// from the iOS repo by tools/sync-share-page.py -- it decodes the exact payload
// TradeShare encodes, so the app is the source of truth. Imported as a Text
// module (see the "rules" entry in wrangler.jsonc), not inlined.
import SHARE_PAGE from './share-page.html';

// Universal Links: Apple fetches this to learn which app owns which paths on
// this domain. Must be served over HTTPS with no redirect. The appID is
// <Team ID>.<bundle ID>, and the /p/* component matches TradeShare.pathPrefix.
// Mirrors web/.well-known/apple-app-site-association in the iOS repo, which the
// legacy tradevision-web.pages.dev host still serves for links shared before the
// domain move -- both files must keep working, forever.
const APPLE_APP_SITE_ASSOCIATION = {
  applinks: {
    details: [
      {
        appIDs: ['GGXR6KH9J7.VishnuMuthiah.TradeVision'],
        components: [
          {
            '/': '/p/*',
            comment: 'Share links open the app directly; the path segment carries the trade.',
          },
        ],
      },
    ],
  },
};

// App Links: Google's Digital Asset Links fetcher reads this to learn which
// Android app owns which URLs on this domain, which is what lets `autoVerify`
// promote the app to the default handler instead of showing a chooser. Must be
// served over HTTPS with no redirect, as application/json.
//
// Mirrors docs/applinks/assetlinks.json in the Android repo, and the copy the
// legacy tradevision-web.pages.dev host has served since 2026-07-20 for links
// shared before the domain move -- both must keep working, forever.
//
// The single fingerprint here is the DEBUG keystore's. Play App Signing re-signs
// the uploaded bundle with a different certificate, so before the Play release
// the release cert's SHA-256 (Play Console -> App integrity) has to be APPENDED
// to this array -- appended, not swapped, so debug builds keep verifying too.
// Until then, release builds fall back to the chooser.
const ANDROID_ASSET_LINKS = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'com.tradevision.app',
      sha256_cert_fingerprints: [
        '02:9F:CA:C5:C6:12:D6:C8:8A:EE:42:E0:29:06:1A:C1:52:D9:54:81:56:90:99:D2:B7:97:23:59:D3:99:1B:6A',
      ],
    },
  },
];

// Hostname of the OptionsVision product site. One Worker serves both sites; the
// router branches on this so the app domain gets the app's navy theme and a
// product homepage, while vishnumuthiah.com stays the light portfolio.
const APP_HOST = 'optionsvision.app';

// ===== CACHING =====
// Every page this Worker serves is a pure function of its URL: the content
// changes when we deploy, never per-request. Until 2026-07-26 the responses
// carried no cache-control at all, so every visit -- including a repeat visit
// and every internal navigation -- came back to the Worker and rebuilt the whole
// page. These headers let a browser skip the network entirely, and let the edge
// hold a copy (see cacheKey below for why that can't go stale across a deploy).
//
// max-age is deliberately short: a deploy should be visible to someone already
// on the site within a few minutes without a hard reload.
const HTML_CACHE_CONTROL = 'public, max-age=300, s-maxage=86400';

/// Assets under public/ are served by the asset layer before this code runs, so
/// their caching is Cloudflare's default (immutable, keyed by content hash) and
/// nothing here applies to them.
function html(body, cacheControl = HTML_CACHE_CONTROL) {
  return new Response(body, {
    headers: {
      'content-type': 'text/html;charset=UTF-8',
      'cache-control': cacheControl,
    },
  });
}

/// Build a page once per isolate instead of once per request. The page builders
/// below are string concatenation over module constants -- same input, same
/// output, forever -- but they were being re-run on every hit. Wrapping rather
/// than hoisting to `const PAGE = getHomepageHTML()` is deliberate: a top-level
/// call would run before the `const GUIDES` further down the file is
/// initialised and die in the temporal dead zone. This defers to first use.
function once(build) {
  let built;
  return () => (built ??= build());
}

/// The keyed form, for the page families (legal routes, guides) that take an
/// argument from a small fixed set.
function onceBy(build) {
  const built = new Map();
  return (key, ...rest) => {
    if (!built.has(key)) built.set(key, build(key, ...rest));
    return built.get(key);
  };
}

// ===== PER-TRADE LINK PREVIEWS =====
// A /p/ link carries the whole trade in its path, so the Worker can decode it and
// write a headline naming the actual trade instead of a generic one. Everything
// below treats the payload as hostile: it is attacker-controlled input that ends
// up inside an HTML attribute, so every value is type-checked, clamped, and
// escaped, and any failure falls back to the page's static tags rather than
// throwing. Only optionsvision.app gets this -- the legacy Pages host is static.

/// The static headline in share-page.html, swapped out when a trade decodes.
const SHARE_DEFAULT_HEADLINE = 'See any options trade before you place it';

/// Longest payload worth attempting; a real trade is a few hundred bytes.
const MAX_SHARE_PAYLOAD = 4096;

function decodeSharePayload(payload) {
  if (!payload || payload.length > MAX_SHARE_PAYLOAD) return null;
  // base64url -> base64, restoring the padding TradeShare strips.
  let b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  try {
    const json = atob(b64);
    const trade = JSON.parse(json);
    return trade && typeof trade === 'object' && !Array.isArray(trade) ? trade : null;
  } catch {
    return null;                       // truncated, re-encoded, or just not ours
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/// "AAPL $227.50 Long Call · Aug 15" — facts carried in the link, nothing computed.
/// Deliberately no P&L: max profit depends on the pricing engine, and a number that
/// disagrees with what the page then draws is worse than no number.
function shareHeadline(trade) {
  if (!trade) return null;

  // Validate rather than scrub. Stripping bad characters out of a hostile symbol
  // leaves a plausible-looking headline built from an attack string; refusing it
  // outright falls back to the generic card, which is the right outcome.
  const raw = typeof trade.symbol === 'string' ? trade.symbol.trim().toUpperCase() : '';
  const symbol = /^[A-Z]{1,6}(\.[A-Z]{1,2})?$/.test(raw) ? raw : '';

  const strikeText = (v) =>
    typeof v === 'number' && isFinite(v) && v > 0 && v < 1e7
      ? '$' + (Number.isInteger(v) ? v.toString() : v.toFixed(2))
      : null;
  const s1 = strikeText(trade.strike);
  const s2 = strikeText(trade.strike2);
  const strikes = s1 && s2 ? `${s1}/${s2}` : (s1 || '');

  // TradeKind encodes as its Swift raw value -- "Long Call", "Cash-Secured Put",
  // "Call Debit Spread". Anything that isn't shaped like one is dropped rather
  // than scrubbed, for the same reason as the symbol above.
  const rawKind = typeof trade.kind === 'string' ? trade.kind.trim() : '';
  const kind = /^[A-Za-z][A-Za-z -]{0,31}$/.test(rawKind) ? rawKind : '';

  const m = trade.expMonth, d = trade.expDay;
  const expiry = Number.isInteger(m) && m >= 1 && m <= 12 && Number.isInteger(d) && d >= 1 && d <= 31
    ? `${MONTHS[m - 1]} ${d}`
    : '';

  // Need at least a symbol and something describing the position to beat the
  // generic headline.
  if (!symbol || (!kind && !strikes)) return null;

  const lead = [symbol, strikes, kind].filter(Boolean).join(' ');
  return expiry ? `${lead} · ${expiry}` : lead;
}

/// The share page with its headline personalised, or untouched if we can't do better.
function sharePageFor(path) {
  const headline = shareHeadline(decodeSharePayload(path.slice('/p/'.length)));
  if (!headline) return SHARE_PAGE;
  return SHARE_PAGE.split(`content="${SHARE_DEFAULT_HEADLINE}"`)
                   .join(`content="${escapeHTML(headline).replace(/"/g, '&quot;')}"`);
}

// ===== MEMOISED PAGES =====
// One entry per page the router can serve. Referencing the builders here (rather
// than calling them) is what keeps this safe to place above their declarations.
// sharePageFor is deliberately absent: its input is an unbounded attacker-supplied
// payload, so it must not key a Map that lives for the isolate's lifetime -- the
// edge cache handles repeat hits on a given share link instead.
const homePage = once(getHomepageHTML);
const privacyPolicyPage = once(getPrivacyPolicyHTML);
const termsOfServicePage = once(getTermsOfServiceHTML);
const supportPage = once(getSupportHTML);
const sourcesTrackerPage = once(getSourcesTrackerHomepageHTML);
const appHomePage = once(getTradeVisionHTML);
const appSupportPage = once(getAppSupportHTML);
const learningLibraryPage = once(getLearningLibraryHTML);
const modelPage = once(getModelHTML);
const modelImportPage = once(getModelImportHTML);
const appLegalPage = onceBy(getAppLegalHTML);
/// Keyed by slug rather than by the guide object so a rebuilt GUIDES entry can't
/// silently produce a second cache line for the same page.
const guidePage = onceBy((_slug, guide) => getGuideHTML(guide));

export default {
  async fetch(request, env, ctx) {
    // Only GET is cacheable -- cache.put() rejects anything else, and this site
    // has no non-GET routes to begin with.
    if (request.method !== 'GET') return route(request);

    const cache = caches.default;
    const key = cacheKey(request, env);
    const hit = await cache.match(key);
    if (hit) return hit;

    const response = await route(request);
    // Redirects and errors stay out; only fully-built pages are worth storing,
    // and cache.put() derives its TTL from the response's own cache-control.
    if (response.status === 200) {
      ctx.waitUntil(cache.put(key, response.clone()));
    }
    return response;
  },
};

/// The edge cache is NOT cleared by a deploy, which would make a long s-maxage a
/// trap: push a fix, and datacenters that already hold the old page keep serving
/// it for a day. Folding the deployed version id into the key sidesteps that --
/// every deploy starts from a cold, empty namespace and the old entries simply
/// age out. `?__v` never reaches the origin; it exists only to key the cache.
function cacheKey(request, env) {
  const url = new URL(request.url);
  url.searchParams.set('__v', env.CF_VERSION?.id ?? 'dev');
  return new Request(url, request);
}

async function route(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const isAppSite = url.hostname === APP_HOST || url.hostname.endsWith('.' + APP_HOST);

  // ===== optionsvision.app — the product site =====
  if (isAppSite) {
    // ---- Universal Links ----
    // Apple requires HTTPS and no redirect here. Serve it as application/json
    // (the legacy Pages host serves application/octet-stream, which iOS also
    // accepts, but there is no reason to be loose about it).
    if (path === '/.well-known/apple-app-site-association') {
      return new Response(JSON.stringify(APPLE_APP_SITE_ASSOCIATION, null, 2), {
        headers: {
          'content-type': 'application/json',
          // Apple's CDN caches this; keep it short so a change propagates.
          'cache-control': 'public, max-age=3600',
        },
      });
    }

    // ---- App Links (Android) ----
    // Same contract as the AASA above: HTTPS, no redirect, application/json.
    if (path === '/.well-known/assetlinks.json') {
      return new Response(JSON.stringify(ANDROID_ASSET_LINKS, null, 2), {
        headers: {
          'content-type': 'application/json',
          // Google's fetcher caches this; keep it short so appending the release
          // cert's fingerprint propagates without a long wait.
          'cache-control': 'public, max-age=3600',
        },
      });
    }

    // Share links. The payload is the single path segment after /p/ and is
    // read client-side from location.pathname, so every /p/<payload> serves
    // the same page -- this is a rewrite, never a redirect, or the payload
    // would be lost.
    if (path.startsWith('/p/')) {
      return html(sharePageFor(path));
    }

    // The legal pages here are OptionsVision's own, generated from the app.
    // They are deliberately NOT the portfolio's same-named routes, which
    // document the Sources Tracker Google Slides add-on.
    if (APP_LEGAL_ROUTES[path]) {
      return html(appLegalPage(APP_LEGAL_ROUTES[path]));

    } else if (path === '/support') {
      return html(appSupportPage());

    } else if (path === '/') {
      return html(appHomePage());

    } else if (path === '/model' || path === '/model/') {
      return html(modelPage());

    } else if (path === '/model/import' || path === '/model/import/') {
      return html(modelImportPage());

    } else if (path === '/resources' || path === '/resources/') {
      return html(learningLibraryPage());

    } else if (path.startsWith('/resources/')) {
      // An unknown slug is not a guide; send it to the index rather than
      // serving an empty page for anything under /resources/.
      const slug = path.slice('/resources/'.length).replace(/\/+$/, '');
      const guide = GUIDES.find((g) => g.slug === slug);
      if (guide) return html(guidePage(slug, guide));
      return Response.redirect(url.origin + '/resources', 302);

    // The old /learn paths, renamed to /resources 2026-08-04. Kept as 301s
    // rather than dropped: the library and every guide under it have been
    // indexed and shared, and a 301 is what carries that to the new address.
    // Guides move slug-for-slug, so the mapping is mechanical -- but an unknown
    // slug goes to the index directly rather than to /resources/<unknown>,
    // which would only bounce again.
    } else if (path === '/learn' || path === '/learn/') {
      return Response.redirect(url.origin + '/resources', 301);

    } else if (path.startsWith('/learn/')) {
      const slug = path.slice('/learn/'.length).replace(/\/+$/, '');
      const known = GUIDES.some((g) => g.slug === slug);
      return Response.redirect(url.origin + '/resources' + (known ? '/' + slug : ''), 301);

    } else {
      // The product site is a single page for now, so /optionsvision,
      // /tradevision and anything else land on the root instead of 404ing.
      return Response.redirect(url.origin + '/', 301);
    }
  }

  // ===== vishnumuthiah.com — the portfolio =====
  if (path === '/privacy-policy') {
    return html(privacyPolicyPage());

  } else if (path === '/terms-of-service') {
    return html(termsOfServicePage());

  } else if (path === '/support') {
    return html(supportPage());

  } else if (path === '/sources-tracker') {
    return html(sourcesTrackerPage());

  } else if (path === '/optionsvision' || path === '/tradevision') {
    // Both retired 2026-07-25. /optionsvision used to serve a light-theme
    // mirror of optionsvision.app -- the same content twice, on two domains,
    // which is the duplication this removes. They stay as 301s rather than
    // 404s because neither can be recalled: /tradevision is the old app-name
    // URL, and both have been shared and indexed.
    return Response.redirect('https://optionsvision.app/', 301);

  } else {
    return html(homePage());
  }
}


// ===== SHARED STYLES (Edit once, applies everywhere) =====
function getSharedStyles() {
  return `
    <style>
      /* ===== THEME TOKENS =====
         One navy palette for both sites, taken from the app's Theme.swift.
         It used to live in getAppThemeStyles() and be injected only for
         optionsvision.app, over a light default for the portfolio; the
         portfolio went navy too on 2026-07-26, so the override collapsed into
         the default and that function is gone. Every rule below still reads a
         variable and never a hex, so a future retheme stays a token edit. */
      :root {
        --bg: #0E1B33;          /* launchNavy */
        --text: #EBE6DA;        /* off-white -- never pure white on this ground */
        --text-body: #C7D3E6;
        --text-muted: #AABBD8;
        --accent: #6BCCF5;
        --accent-hover: #9BDDF8;
        --on-accent: #0E1B33;   /* navy label on the bright accent */
        --surface: #1A263D;     /* boxFill */
        --surface-alt: #16233F; /* wellFill */
        --surface-code: #16233F;
        --border: #26364A;
        --panel: #16233F;
        --shadow: rgba(0, 0, 0, 0.45);
        /* The app's Pro gold. Section chrome only -- eyebrows and band titles --
           so it never competes with the blue that signals "this is a link". */
        --gold: #D9AE57;
        /* Held at the page ground: on navy, tinting the bar a second, paler navy
           separates it from the page for no reason. */
        --stickybar-bg: var(--bg);
      }
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        line-height: 1.6;
        color: var(--text);
        background: var(--bg);
      }
      .container {
        max-width: 900px;
        margin: 0 auto;
        padding: 44px 20px;
      }
      header {
        margin-bottom: 22px;
        border-bottom: 3px solid var(--accent);
        padding-bottom: 12px;
      }
      h1 {
        font-size: 48px;
        margin-bottom: 4px;
        color: var(--text);
      }
      h2 {
        font-size: 32px;
        margin-top: 0;
        margin-bottom: 8px;
        color: var(--text);
      }
      h3 {
        font-size: 20px;
        margin-bottom: 8px;
        color: var(--text);
      }
      p, li {
        margin-bottom: 10px;
        color: var(--text-body);
      }
      ul {
        margin-left: 20px;
        margin-bottom: 15px;
      }
      a {
        color: var(--accent);
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
      strong {
        color: var(--text);
      }
      code {
        background: var(--surface-code);
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 14px;
      }
      .tagline {
        font-size: 20px;
        color: var(--text-muted);
        margin-bottom: 6px;
      }
      .contact-links {
        margin-top: 6px;
      }
      .contact-links a {
        margin-right: 20px;
      }
      section {
        margin-bottom: 28px;
      }
      .about {
        font-size: 18px;
        line-height: 1.8;
        color: var(--text-body);
      }
      .project-grid {
        display: grid;
        gap: 18px;
        margin-top: 16px;
      }
      .project-card {
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 18px 24px;
        background: var(--surface);
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .project-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 4px 12px var(--shadow);
      }
      .project-card h3 {
        font-size: 24px;
        margin-bottom: 10px;
        color: var(--accent);
      }
      .project-card p {
        color: var(--text-muted);
        margin-bottom: 15px;
      }
      .project-card .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 15px;
      }
      .tag {
        background: var(--surface-alt);
        color: var(--accent);
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
      }
      .project-links a {
        display: inline-block;
        margin-right: 15px;
        font-weight: 500;
      }
      .experience {
        background: var(--surface);
        padding: 18px 24px;
        border-radius: 8px;
        margin-top: 12px;
      }
      .experience ul {
        list-style: none;
        padding-left: 0;
      }
      .experience li {
        padding: 3px 0;
        margin-bottom: 0;
      }
      .experience li:before {
        content: "→ ";
        color: var(--accent);
        font-weight: bold;
      }
      .back-link {
        display: inline-block;
        margin-bottom: 30px;
      }
      .updated {
        color: var(--text-muted);
        font-size: 14px;
        margin-bottom: 30px;
      }
      .contact-info {
        background: var(--surface-alt);
        padding: 20px;
        border-radius: 8px;
        margin: 20px 0;
      }
      .contact-info strong {
        color: var(--accent);
      }
      footer {
        margin-top: 80px;
        padding-top: 30px;
        border-top: 1px solid var(--border);
        color: var(--text-muted);
        font-size: 14px;
        text-align: center;
      }

      /* ===== PDF Portfolio Embed ===== */
      .portfolio-embed {
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 18px 24px;
        background: var(--surface);
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .portfolio-embed:hover {
        transform: translateY(-4px);
        box-shadow: 0 4px 12px var(--shadow);
      }
      .portfolio-embed h3 {
        font-size: 24px;
        margin-bottom: 10px;
        color: var(--accent);
      }
      .portfolio-embed p {
        color: var(--text-muted);
        margin-bottom: 15px;
      }
      .portfolio-embed .pdf-viewer-wrapper {
        position: relative;
        width: 100%;
        padding-top: 75%; /* 4:3 aspect ratio */
        margin: 15px 0;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid var(--border);
        background: var(--panel);
      }
      .portfolio-embed .pdf-viewer-wrapper iframe {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border: none;
      }
      .portfolio-embed .pdf-fallback {
        display: none;
        text-align: center;
        padding: 40px 20px;
        background: var(--panel);
        border-radius: 8px;
        border: 1px solid var(--border);
        margin: 15px 0;
      }
      .portfolio-embed .pdf-fallback p {
        margin-bottom: 15px;
        color: var(--text-muted);
      }
      .portfolio-embed .pdf-download-btn {
        display: inline-block;
        padding: 10px 24px;
        background: var(--accent);
        color: var(--on-accent);
        border-radius: 6px;
        font-weight: 500;
        text-decoration: none;
        transition: background 0.2s;
      }
      .portfolio-embed .pdf-download-btn:hover {
        background: var(--accent-hover);
        text-decoration: none;
      }

      </style>
  `;
}

// ===== PAGE-SPECIFIC STYLES =====
/// Component fixes that must load AFTER a page's own stylesheet.
/// getCarouselCSS() and getTradeVisionPageStyles() still carry light literals
/// for the band, arrows, dots and play button, and they reach the page through
/// getLayout's additionalStyles slot -- so these rules only win if they come
/// later. This was getAppThemeStyles(), injected only for optionsvision.app;
/// both sites went navy on 2026-07-26, so it is unconditional now.
function getNavyComponentStyles() {
  return `
    <style>
      /* ===== Components that need explicit navy treatment =====
         These were getAppThemeStyles(), injected only for optionsvision.app.
         Both sites are navy now, so they are unconditional. The literals that
         remain (carousel band, arrows, dots, play button) live in
         getCarouselCSS() and getTradeVisionPageStyles() as light values; these
         rules are what put them right, and must stay loaded after them. */


      /* --- Tinted bands: the light #f4f6f8/#e6e9ec pair has no token --- */
      .tv-band,
      .portfolio-embed {
        background: var(--surface);
        border-color: var(--border);
      }
      /* Both band titles ("Demo Videos" and "Demo Walkthrough") take gold; the
         walkthrough one is an h3 inside .tv-copy, so it needs the two-class
         selector to outrank the accent color on .tv-copy h3 below. */
      .tv-band-title,
      .tv-copy .tv-walkthrough h3 { color: var(--gold); }
      .tv-copy h3 { color: var(--accent); }

      /* --- Media frames and captions --- */
      .tv-gallery img,
      .tv-short-frame { border-color: var(--border); }
      .tv-gallery figcaption,
      .tv-carousel-caption { color: var(--text-muted); }
      .tv-disclaimer {
        color: var(--text-muted);
        border-top-color: var(--border);
      }

      /* --- Carousel controls: white pills punch holes in the navy ground --- */
      .tv-carousel-arrow {
        background: var(--surface);
        border-color: var(--border);
        color: var(--accent);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
      }
      .tv-carousel-arrow:hover {
        background: #22314D;
        box-shadow: 0 3px 12px rgba(0, 0, 0, 0.5);
      }
      .tv-carousel-dot { background: #33445F; }
      .tv-carousel-dot.active { background: var(--accent); }

      /* --- Play button keeps the launch screen's off-white-on-navy pairing --- */
      .tv-play-overlay { background: rgba(235, 230, 218, 0.92); }
      .tv-play-overlay:hover { background: rgba(244, 241, 234, 0.98); }
      .tv-play-overlay svg { fill: #0E1B33; }

      /* No App Store badge rule here any more. The badge is Apple's supplied
         SVG, styled in getTradeVisionPageStyles; the dark hover shadow this
         sheet used to add existed to lift the hand-drawn black pill off the
         navy, and does nothing under artwork that ships its own border. */
    </style>
  `;
}

function getSupportPageStyles() {
  return `
    <style>
      /* Tokenised 2026-07-26 with the navy retheme. This was the last sheet
         holding literals -- a #f8f9fa ground behind a white card -- which on
         navy would have rendered a white box on a dark page. */
      body {
        background-color: var(--bg);
        padding: 20px;
      }
      .container {
        background-color: var(--surface);
        padding: 40px;
        border-radius: 12px;
        box-shadow: 0 2px 8px var(--shadow);
        max-width: 800px;
      }
      h1 {
        color: var(--accent);
        font-size: 2em;
      }
      h2 {
        margin-top: 30px;
        font-size: 1.5em;
        border-bottom: 2px solid var(--accent);
        padding-bottom: 10px;
      }
      h3 {
        color: var(--text-muted);
        margin-top: 20px;
      }
      .back-link {
        margin-top: 30px;
        padding: 10px 20px;
        background-color: var(--accent);
        color: var(--on-accent);
        border-radius: 6px;
        text-decoration: none;
      }
      .back-link:hover {
        background-color: var(--accent-hover);
        text-decoration: none;
      }
    </style>
  `;
}

function getLegalPageStyles() {
  return `
    <style>
      h1 {
        font-size: 36px;
      }
      h2 {
        font-size: 24px;
        margin-top: 30px;
        margin-bottom: 15px;
        color: var(--accent);
      }
      h3 {
        font-size: 18px;
        margin-top: 20px;
        margin-bottom: 10px;
      }
    </style>
  `;
}

// ===== TradeVision page-specific styles =====
function getTradeVisionPageStyles() {
  return `
    <style>
      /* Scoped to the TradeVision page: this whole style block only loads here. */
      /* Tighten the top of the page */
      .back-link { margin-bottom: 10px; }
      h1 { margin-top: 0; }
      /* (1) Modestly wider page; text fills the full width */
      .container { max-width: 1000px; padding-top: 32px; }

      /* Walkthrough card matches the tinted band aesthetic */
      .portfolio-embed {
        background: #f4f6f8;
        border-color: #e6e9ec;
        border-radius: 16px;
      }
      /* Walkthrough sits at the top of "How It Works" — kept tight */
      .tv-walkthrough {
        margin-top: -6px;
        padding-top: 14px;
        padding-bottom: 10px;
      }
      /* .tv-copy h3 (defined later, equal specificity) was overriding the margins here,
         so scope with the parent to win the cascade. */
      .tv-copy .tv-walkthrough h3 {
        margin-top: 0;
        margin-bottom: 22px;
        text-align: center;
        font-size: 28px;
      }
      /* Demo Videos band title: match the "Demo Walkthrough" heading (scoped to /tradevision) */
      .tv-band-title {
        font-size: 28px;
      }
      .tv-walkthrough .tv-carousel {
        margin: 6px auto 6px;
      }

      /* App Store CTA badge */
      .tv-cta {
        margin: 22px 0 8px;
      }
      /* Apple's supplied badge carries its own shape, fill and type, so the
         wrapper is just the hit area and the hover lift. The pill, the Apple
         glyph and the two lines of text used to be drawn here. */
      .appstore-badge {
        display: inline-block;
        line-height: 0;
        text-decoration: none;
        border-radius: 8px;
        transition: transform 0.15s ease, opacity 0.15s ease;
      }
      .appstore-badge__svg {
        display: block;
        width: 170px;
        height: auto;
      }
      .appstore-badge:hover {
        transform: translateY(-2px);
        opacity: 0.88;
        text-decoration: none;
      }
      @media (max-width: 600px) {
        .appstore-badge__svg { width: 158px; }
      }

      /* =====================================================================
         Landing-page shell
         =====================================================================
         Everything below is scoped to .ov-page (or to .ov-nav, which only the
         product page emits). This sheet is also loaded by the /resources guide
         pages, and they must keep the 736px editorial measure.

         SPECIFICITY NOTE, and it is load-bearing: getLayout() injects this
         block as additionalStyles, which sits BEFORE getPortfolioHomeStyles()
         in <head>. So at equal specificity that later sheet wins. Anything here
         that overrides a .pf-* rule therefore uses a compound selector
         (.pf-page.ov-page = 0,2,0) rather than relying on source order. */

      /* .pf-page caps every page at 736px -- an essay measure, correct for the
         portfolio and the guides. A product landing page is not a document, so
         the product page alone takes a wider shell. */
      .pf-page.ov-page {
        max-width: 1180px;
        padding: 0 32px 72px;
      }

      /* ---- Persistent nav ----
         The scroll-triggered .tv-stickybar still does its job further down the
         page; this is the at-rest bar that makes the first viewport navigable.
         The two never coexist visually: the sticky bar only slides in once this
         one has scrolled away. */
      .ov-nav {
        max-width: 1180px;
        margin: 0 auto;
        padding: 20px 32px 0;
        display: flex;
        align-items: center;
        gap: 30px;
      }
      /* Centred, same as .tv-stickybar__brand. The flex-end this used to run was
         tuned against a serif wordmark; swapping to bold sans changes the text
         box metrics, so that tuning no longer described anything. Matching the
         bar's alignment also means the mark does not jump when one replaces the
         other on scroll. */
      .ov-nav__brand {
        display: flex;
        align-items: center;
        gap: 9px;
        text-decoration: none;
        flex: 0 0 auto;
      }
      .ov-nav__brand:hover { text-decoration: none; }
      /* Serif, and it has to stay serif. LaunchView.swift renders the app's
         wordmark in IowanOldStyle-Roman -- the same face .pf-serif names here --
         and does it deliberately: it probes for the font at runtime and falls
         back to New York rather than let SwiftUI drop silently to sans, so that
         the app and the site render the wordmark in the identical typeface
         rather than two serifs that merely resemble each other.

         This was briefly set in bold sans to match the sticky bar, which had
         the fix backwards: it traded a mismatch between two bars on one site
         for a mismatch between the site and the product. The bar moved to serif
         instead.

         Larger here than in the bar (1.75rem against 1.45rem) on purpose: an
         at-rest masthead can afford the room, a fixed strip over live content
         cannot. */
      .ov-nav__wordmark {
        font-size: 1.75rem;
        line-height: 1;
        color: var(--text);
        letter-spacing: -0.012em;
      }
      /* The mark ships at 94px for the old 72px masthead. Beside a 1.75rem
         wordmark it comes down to suit, the same way .ov-lockup--entry does --
         and it moves with the wordmark, so the lockup keeps its proportions. */
      .ov-nav .ov-mark { width: 36px; margin-bottom: 3px; }
      .ov-nav__links {
        display: flex;
        gap: 26px;
        margin-left: auto;
      }
      .ov-nav__links a {
        color: var(--text-body);
        text-decoration: none;
        font-size: 0.9375rem;
        transition: color 0.15s ease;
      }
      /* Hover goes bold and white, not accent. Bold is wider than regular, so
         hovering an item in a flex row would shove its neighbours sideways --
         .ov-nav__reserve holds the BOLD width at all times by rendering the
         label a second time, bold and zero-height, inside the same box. The
         visible text then only changes weight, never the box. */
      .ov-nav__reserve {
        display: inline-flex;
        flex-direction: column;
      }
      .ov-nav__reserve::after {
        content: attr(data-label);
        height: 0;
        overflow: hidden;
        visibility: hidden;
        font-weight: 700;
        pointer-events: none;
        /* Nothing here may be read aloud -- it is the same words twice. */
        speak: never;
      }
      .ov-nav__links a:hover {
        color: var(--text);
        font-weight: 700;
        text-decoration: none;
      }
      /* ---- "Model on the Web" menu ----
         Rendered in BOTH bars, so every rule here is keyed on its own classes
         rather than on .ov-nav. One consequence worth knowing: getMotionStyles
         loads after this sheet and defines .tv-stickybar__links a at (0,1,1),
         so the menu's own link rule is written as .ov-nav__menuwrap
         .ov-nav__menu a -- (0,2,1) -- or the bar's colour would win inside the
         dropdown. */
      .ov-nav__menuwrap { position: relative; }
      .ov-nav__menubtn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 0;
        background: none;
        border: 0;
        font: inherit;
        font-size: 0.9375rem;
        color: var(--text-body);
        cursor: pointer;
        white-space: nowrap;
        transition: color 0.15s ease;
      }
      .ov-nav__caret {
        width: 10px;
        height: 6px;
        flex: 0 0 auto;
        transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .ov-nav__menu {
        position: absolute;
        top: calc(100% + 10px);
        left: 50%;
        transform: translateX(-50%) translateY(-6px);
        z-index: 60;
        /* Fixed, not min-width: the labels go bold on hover, and a content-sized
           panel would grow by a few pixels under the pointer. 340 clears the
           longest label at bold with room for the badge. */
        width: 340px;
        padding: 6px;
        border: 1px solid var(--border);
        border-radius: 14px;
        background: var(--surface);
        box-shadow: 0 26px 46px -20px rgba(0, 0, 0, 0.92);
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transition: opacity 0.18s ease,
                    transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
                    visibility 0s 0.22s;
      }
      /* A gap between the button and the panel would close the menu the moment
         the pointer crossed it. This bridges it -- invisible, and only while
         the menu is open, so it never sits over anything clickable at rest. */
      .ov-nav__menu::before {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        top: -12px;
        height: 12px;
      }
      /* The crown sits on the RIGHT. On the left it occupied a gutter only the
         second item had, so the two labels started at different x and the menu
         read as misaligned -- which is what looked wrong about it. On the right
         both labels share a left edge and the badge forms its own column. */
      .ov-nav__menuwrap .ov-nav__menu a {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 9px 12px;
        border-radius: 10px;
        color: var(--text-body);
        font-size: 0.9375rem;
        text-decoration: none;
        white-space: nowrap;
        transition: background 0.14s ease, color 0.14s ease;
      }
      .ov-nav__menuwrap .ov-nav__menu a:hover {
        background: var(--surface-alt);
        color: var(--text);
        text-decoration: none;
      }
      .ov-nav__menu-txt {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .ov-nav__menu-label {
        color: var(--text);
        line-height: 1.25;
        transition: font-weight 0.12s ease;
      }
      /* Only the white label bolds. The description underneath stays muted and
         regular, so the row gains emphasis without the whole block thickening. */
      .ov-nav__menuwrap .ov-nav__menu a:hover .ov-nav__menu-label { font-weight: 700; }
      /* The second line is the point of the change. Two bare labels in a large
         panel left the menu mostly padding, and "Manual Input" does not say what
         it does on its own. A line of explanation fills the space with something
         worth reading instead of shrinking the panel around nothing. */
      .ov-nav__menu-desc {
        font-size: 0.8125rem;
        color: var(--text-muted);
        line-height: 1.3;
      }
      /* A lone crown assumes the reader already knows the convention. Tinting it
         into a badge makes it read as a status marker on the row rather than a
         decoration floating beside the text. The accessible name is carried by
         the visually hidden span next to it, so it is not title-only. */
      .ov-nav__pro {
        display: inline-flex;
        align-items: center;
        flex: 0 0 auto;
        padding: 4px 7px;
        border-radius: 7px;
        background: rgba(217, 174, 87, 0.14);
      }
      .ov-crown {
        width: 15px;
        height: 15px;
        flex: 0 0 auto;
        fill: var(--gold);
      }
      .ov-nav__menuwrap.is-open .ov-nav__menubtn { color: var(--text); font-weight: 700; }
      .ov-nav__menuwrap.is-open .ov-nav__caret { transform: rotate(180deg); }
      .ov-nav__menuwrap.is-open .ov-nav__menu,
      .ov-nav__menuwrap:focus-within .ov-nav__menu {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
        transform: translateX(-50%) translateY(0);
        transition: opacity 0.18s ease,
                    transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
                    visibility 0s;
      }
      @media (hover: hover) and (pointer: fine) {
        .ov-nav__menuwrap:hover .ov-nav__menubtn { color: var(--text); font-weight: 700; }
        .ov-nav__menuwrap:hover .ov-nav__caret { transform: rotate(180deg); }
        .ov-nav__menuwrap:hover .ov-nav__menu {
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
          transform: translateX(-50%) translateY(0);
          transition: opacity 0.18s ease,
                      transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
                      visibility 0s;
        }
      }
      .ov-nav__cta {
        flex: 0 0 auto;
        background: var(--accent);
        color: var(--on-accent);
        font-size: 0.9375rem;
        font-weight: 600;
        padding: 9px 18px;
        border-radius: 999px;
        text-decoration: none;
        transition: background 0.15s ease, transform 0.15s ease;
      }
      /* text-decoration: none is load-bearing here, not defensive. getSharedStyles
         sets a blanket a:hover { text-decoration: underline }, which was drawing
         a line under the pill's label. */
      .ov-nav__cta,
      .ov-nav__cta:hover {
        text-decoration: none;
      }
      .ov-nav__cta:hover {
        background: var(--accent-hover);
        transform: translateY(-1px);
      }
      /* Phones keep the brand and the CTA and drop the section links -- four
         anchors will not fit beside a pill at 360px, and every one of them is
         reachable by scrolling. */
      @media (max-width: 860px) {
        .ov-nav__links { display: none; }
        .ov-nav__cta { margin-left: auto; }
      }
      @media (max-width: 600px) {
        .ov-nav { padding: 16px 20px 0; gap: 16px; }
        .ov-nav__wordmark { font-size: 1.5rem; }
        .ov-nav .ov-mark { width: 31px; }
      }

      /* ---- Hero ----
         Two columns: the claim on the left, the product on the right. The old
         hero was a centred wordmark over a 47-word paragraph, which put nothing
         on screen that showed what the app does. */
      .ov-page .ov-hero {
        display: grid;
        /* Copy column widened from 1.08fr and the gutter pulled in from 56px.
           Both exist to buy width for the proof list underneath, whose longest
           line was wrapping in a cell that was a few pixels short. The frame is
           capped at 430px anyway, so the column it sits in was carrying slack
           it never used. */
        grid-template-columns: minmax(0, 1.22fr) minmax(0, 0.78fr);
        gap: 44px;
        align-items: center;
        padding: 60px 0 34px;
        border-bottom: 0;
        margin-bottom: 0;
      }
      /* The h1 used to be the word "OptionsVision" -- a brand name where the
         page's single strongest line should be making a claim. */
      .ov-page .ov-hero__title {
        margin: 0;
        font-size: clamp(2.5rem, 4.9vw, 3.9rem);
        line-height: 1.04;
        letter-spacing: -0.022em;
        font-weight: 400;
        color: var(--text);
        text-wrap: balance;
      }
      /* Gold, at the user's direction. It clears the 16px floor the rest of the
         gold on these sites is held to -- 17px at its smallest -- so it stays
         legible at the size the rule was written to protect. */
      .ov-hero__sub {
        margin: 20px 0 0;
        max-width: 30em;
        color: var(--gold);
        font-size: clamp(1.0625rem, 1.5vw, 1.1875rem);
        line-height: 1.55;
      }
      /* Wider than the 20px above the subhead: with the eyebrow gone the copy
         runs headline -> subhead -> button with nothing to break it, and the
         button needs to read as a separate move rather than a fourth line. */
      .ov-hero__cta {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 18px;
        margin: 38px 0 0;
      }
      /* Apple asks that the badge be used as supplied, so it is not restyled --
         it is enlarged and given a halo instead. Black-on-navy was the lowest
         contrast element on a page whose whole job is that one tap. */
      .ov-hero__cta .appstore-badge__svg { width: 196px; }
      .ov-hero__cta .appstore-badge {
        border-radius: 10px;
        box-shadow: 0 0 0 1px rgba(107, 204, 245, 0.22), 0 10px 26px -12px rgba(0, 0, 0, 0.8);
      }
      /* In-page links travel instead of teleporting. Declared inside the
         no-preference query rather than as a plain rule plus an override: an
         animated scroll is a motion effect, and a visitor who has asked for
         reduced motion should never get it, including on a browser that only
         honours the media query and not a later reset.

         This sheet only loads on the product host and the /resources guides, which
         are the pages that have in-page anchors at all. */
      @media (prefers-reduced-motion: no-preference) {
        html { scroll-behavior: smooth; }
      }
      /* .tv-stickybar is fixed to the top and slides in as soon as the hero CTA
         clears the viewport -- which it always has by the time an anchor jump
         lands. Without this the bar covers the heading the visitor just asked
         to see. 80px is the bar's own height plus breathing room. */
      .ov-page [id] { scroll-margin-top: 80px; }
      /* Three facts, not a logo wall -- there are no investor logos to show, and
         these are the claims a trader actually weighs. */
      /* A 2x2 grid rather than a wrapping flex row. With four items of uneven
         length, flex-wrap packed them 3-then-1 and the ragged last row read as
         an accident; a fixed two columns keeps the block square whatever the
         copy says. */
      .ov-hero__proof {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px 20px;
        margin: 32px 0 0;
        padding: 0;
        list-style: none;
        font-size: 0.875rem;
        color: var(--text-muted);
      }
      /* align-items: flex-start, not center: these wrap to two lines at some
         widths and a centred dot floats to the middle of the block. */
      .ov-hero__proof li { display: flex; align-items: flex-start; gap: 8px; line-height: 1.4; }
      .ov-hero__proof li::before {
        content: "";
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: var(--accent);
        flex: 0 0 auto;
        /* Sits the dot on the first line's optical centre. Without it the
           flex-start alignment above pins it to the very top of the box. */
        margin-top: 0.5em;
      }

      /* ---- Hero shot ----
         The source screenshot is 900x1955 (1:2.17). Run at the column's full
         width it would stand ~1100px tall and bury the headline, so the frame
         declares its own aspect-ratio and crops from the top: header, plain-
         English summary, chart and both sliders stay; the Greeks read-out below
         the fold of the crop is what gets cut.

         aspect-ratio rather than max-height so the box is sized before the
         image decodes -- with width/height on the <img> as well, this reserves
         its space and contributes no CLS. */
      .ov-hero__frame {
        position: relative;
        width: 100%;
        max-width: 430px;
        margin-left: auto;
        aspect-ratio: 900 / 1150;
        overflow: hidden;
        border-radius: 22px;
        /* Fades the crop into the page ground instead of ending on a hard
           horizontal edge. Masked rather than overlaid with a gradient so it
           stays correct if the ground ever changes. */
        -webkit-mask-image: linear-gradient(180deg, #000 78%, transparent 100%);
                mask-image: linear-gradient(180deg, #000 78%, transparent 100%);
      }
      .ov-hero__frame img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: top center;
      }
      /* The awkward band: the hero is still two columns here, so the copy is
         too narrow to split again -- at 1100px a proof cell comes to 288px and
         the longest line needs 293, five pixels short, which is enough to break
         all four onto two rows. One column uses the same space for four single
         lines instead.

         1150 rather than the 1080 this was first set to: measured, cells only
         clear the longest line from about 1151px up, where they reach 308px.
         Bounded at the bottom too -- below 900px the hero stacks and the copy
         runs full width, where two columns fit easily and one would leave half
         of every row empty. */
      @media (min-width: 901px) and (max-width: 1150px) {
        .ov-hero__proof { grid-template-columns: minmax(0, 1fr); gap: 10px; }
      }
      @media (max-width: 900px) {
        .ov-page .ov-hero {
          grid-template-columns: minmax(0, 1fr);
          gap: 40px;
          padding: 40px 0 24px;
        }
        .ov-hero__frame { margin: 0 auto; }
      }
      @media (max-width: 600px) {
        .pf-page.ov-page { padding: 0 20px 56px; }
        .ov-page .ov-hero { padding: 28px 0 18px; gap: 32px; }
        .ov-hero__cta { gap: 12px; margin-top: 24px; }
        /* Two columns of this copy at 375px leaves ~150px a cell, which breaks
           every one of them onto three lines. */
        .ov-hero__proof { grid-template-columns: minmax(0, 1fr); gap: 10px; }
        .ov-hero__cta .appstore-badge__svg { width: 178px; }
        .ov-hero__frame { max-width: 330px; }
      }

      /* =====================================================================
         32 strategies -- eight groups, list on hover
         =====================================================================
         Replaces an eight-item <ul> whose bullets ran to five comma-separated
         strategies each. The group names carry the shape of the range; the
         members are one hover away.

         The panel is absolutely positioned, so opening one never reflows the
         grid or shifts anything below it. :hover on the CARD (not the button)
         keeps it open while the pointer travels down into the panel -- an
         absolutely positioned child is still a DOM descendant, so the ancestor
         stays hovered. */
      .ov-strat {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(215px, 1fr));
        gap: 14px;
        margin: 26px 0 4px;
      }
      .ov-strat__card {
        position: relative;
        border: 1px solid var(--border);
        border-radius: 14px;
        background: var(--surface);
        transition: border-color 0.22s ease,
                    border-radius 0.22s ease,
                    background 0.22s ease;
      }
      .ov-strat__head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        width: 100%;
        padding: 18px 18px 19px;
        background: none;
        border: 0;
        border-radius: 14px;
        font: inherit;
        color: var(--text);
        text-align: left;
        cursor: pointer;
        /* The rule between the title and its list, drawn as an inset shadow
           rather than a border-bottom so turning it on costs no extra pixel of
           height and the card does not twitch by 1px as it opens. */
        box-shadow: inset 0 0 0 rgba(0, 0, 0, 0);
        transition: box-shadow 0.22s ease;
      }
      .ov-strat__name {
        font-size: 1.0625rem;
        font-weight: 600;
        letter-spacing: -0.01em;
        transition: color 0.22s ease, text-shadow 0.22s ease;
      }
      .ov-strat__count {
        flex: 0 0 auto;
        font-size: 0.8125rem;
        color: var(--text-muted);
        font-variant-numeric: tabular-nums;
      }
      /* ---- The drawer ----
         Geometry note, and it is the whole reason this looked like two stacked
         boxes before: an absolutely positioned child resolves its percentages
         against the PADDING box, which sits inside the card's 1px border. So
         left:0 insets the panel one pixel from the card's outer edge on each
         side, and the first version's top:calc(100% - 6px) left the card's
         own rounded bottom border drawn straight across the panel.

         -1px on both sides lines the panel's border box up with the card's, and
         top: 100% starts it exactly on the card's bottom border, which the open
         card then turns transparent and squares off. The two elements read as
         one continuous outline. */
      .ov-strat__panel {
        position: absolute;
        top: 100%;
        left: -1px;
        right: -1px;
        z-index: 6;
        /* 18px sides matches .ov-strat__head, so the first column of names
           starts on the same vertical as the group title above it. */
        padding: 13px 18px 17px;
        border: 1px solid var(--accent);
        border-top: 0;
        border-radius: 0 0 14px 14px;
        background: var(--surface);
        box-shadow: 0 26px 46px -20px rgba(0, 0, 0, 0.9);
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        /* Unrolls from the top instead of sliding: a translate would have to
           travel out from under the card, and at this speed you see it pass
           behind the header. Clipping keeps the motion inside the drawer. */
        clip-path: inset(0 0 100% 0);
        transition: clip-path 0.3s cubic-bezier(0.16, 1, 0.3, 1),
                    opacity 0.16s ease,
                    visibility 0s 0.3s;
      }
      /* .ov-page prefix is doing real work. This grid lives inside .tv-copy, and
         getEditorialCopyStyles() -- which loads AFTER this sheet -- sets
         ".tv-copy ul, .tv-copy ol" to margin 0 0 20px and padding-left 18px.
         That selector and a bare ".ov-strat__panel ul" are BOTH (0,1,1), so the
         tie broke on source order and the editorial rule won: every panel
         carried 20px of dead space under its last item and an 18px indent it
         never asked for. The extra class makes it (0,2,1) and settles it.

         Same reason for the li: the editorial sheet gives list items a 6px
         bottom margin, and the original rule here only set padding, so the
         margin was never reset at all. */
      /* Grid, not wrapping flex. Flex sized each item to its own text, so the
         second column started at a different x on every row and the block read
         as ragged -- which was half of why the pills looked wrong. Fixed
         columns line the names up.

         Row-major order on purpose: the data is ordered long/short in pairs, so
         reading across gives "Long call, Short call" on one line and the two
         columns mean something. Down-then-across would break that.

         What is NOT here is the point: no border, no fill, no radius, no
         padding. A single column of left-aligned names is the shape of a menu,
         which is what made this panel read as a dropdown -- two aligned columns
         is not that shape, so the names need no chrome to escape it.

         Still ul/li, so assistive tech still announces a list of six, and still
         no hover state: these are labels, not controls. */
      .ov-page .ov-strat__panel ul {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 9px 10px;
        margin: 0;
        padding: 0;
        list-style: none;
        /* Without this a grid item stretches to its row's height, so one name
           wrapping makes its neighbour report as tall too. Cosmetically the
           same for text, but it makes the boxes mean what they look like. */
        align-items: start;
      }
      /* 13px, and the column gap is 10 rather than 14, because this came down
         to a single pixel: "Cash-secured put" measures 109px and a 14px gap
         left columns of 108. Measured, not guessed -- at 10px the columns are
         112 and it fits with 3px to spare.
         "Short call (covered)" is ~126px and still wraps. Left alone on
         purpose: it is one label out of 32, and two lines of plain text is an
         ordinary thing to see -- which is exactly why this reads better than a
         pill breaking in half. */
      .ov-page .ov-strat__item {
        margin: 0;
        padding: 0;
        font-size: 0.8125rem;
        line-height: 1.4;
        color: var(--text-body);
      }

      /* Available to a screen reader and to a crawler, painted for nobody. */
      .ov-vh {
        position: absolute;
        width: 1px;
        height: 1px;
        margin: -1px;
        padding: 0;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
        border: 0;
      }

      /* Open state, shared by all three ways in. Hover is gated behind a real
         pointer: on a touch screen :hover sticks after a tap, which would
         leave a panel open with no way to dismiss it. */
      .ov-strat__card.is-open,
      .ov-strat__card:focus-within {
        border-color: var(--accent);
        border-bottom-color: transparent;
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
        background: var(--surface-alt);
        z-index: 7;
      }
      /* Open/hover lifts the title to full white and gives it a soft halo,
         rather than turning it accent-blue. Blue reads as "this is a link" --
         and these are group headings, not links. The glow is the off-white ink
         colour at low alpha, so it reads as the text lighting up rather than a
         coloured shadow behind it. */
      .ov-strat__card.is-open .ov-strat__name,
      .ov-strat__card:focus-within .ov-strat__name {
        color: var(--text);
        text-shadow: 0 0 14px rgba(235, 230, 218, 0.42);
      }
      .ov-strat__card.is-open .ov-strat__head,
      .ov-strat__card:focus-within .ov-strat__head { box-shadow: inset 0 -1px 0 var(--border); }
      .ov-strat__card.is-open .ov-strat__panel,
      .ov-strat__card:focus-within .ov-strat__panel {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
        clip-path: inset(0 0 0 0);
        transition: clip-path 0.3s cubic-bezier(0.16, 1, 0.3, 1),
                    opacity 0.16s ease,
                    visibility 0s;
      }
      @media (hover: hover) and (pointer: fine) {
        .ov-strat__card:hover {
          border-color: var(--accent);
          border-bottom-color: transparent;
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
          background: var(--surface-alt);
          z-index: 7;
        }
        .ov-strat__card:hover .ov-strat__name {
          color: var(--text);
          text-shadow: 0 0 14px rgba(235, 230, 218, 0.42);
        }
        .ov-strat__card:hover .ov-strat__head { box-shadow: inset 0 -1px 0 var(--border); }
        .ov-strat__card:hover .ov-strat__panel {
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
          clip-path: inset(0 0 0 0);
          transition: clip-path 0.3s cubic-bezier(0.16, 1, 0.3, 1),
                      opacity 0.16s ease,
                      visibility 0s;
        }
      }
      /* The panel overlays whatever follows the grid, so the reveal must not be
         the only thing that ever needs that room. Reserved on the last row's
         behalf: enough for the tallest group (six members) plus its padding. */
      .ov-strat + p { margin-top: 18px; }
      /* transition-delay too, not just duration: the closed panel defers its
         visibility switch by the length of the unroll, and a duration override
         alone leaves that delay in place. */
      @media (prefers-reduced-motion: reduce) {
        .ov-strat__card,
        .ov-strat__head,
        .ov-strat__panel {
          transition-duration: 0.01ms;
          transition-delay: 0s;
        }
      }
      /* One column on phones, not two. Two columns at 375px leaves a card about
         160px wide -- roughly 124px of panel interior -- which is narrower than
         a single "Cash-secured put" chip, so every chip would take its own row
         and the widest would overflow the panel. Full width gives ~297px, where
         chips pair up as intended. */
      @media (max-width: 600px) {
        .ov-strat { grid-template-columns: minmax(0, 1fr); gap: 10px; }
        .ov-strat__head { padding: 14px 16px 15px; }
        .ov-strat__name { font-size: 0.9375rem; }
      }

      /* =====================================================================
         /model and /model/import
         ===================================================================== */
      .ov-model { padding-top: 8px; }
      .ov-model__head { padding: 44px 0 30px; max-width: 62ch; }
      .ov-model__title {
        margin: 0;
        font-size: clamp(2.1rem, 4vw, 3.1rem);
        line-height: 1.06;
        letter-spacing: -0.02em;
        font-weight: 400;
        color: var(--text);
      }
      .ov-model__sub {
        margin: 16px 0 0;
        color: var(--text-body);
        font-size: 1.0625rem;
        line-height: 1.55;
      }
      .ov-model__pro {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 14px;
        font-size: 0.8125rem;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: var(--gold);
      }

      .ov-model__form { max-width: 900px; }
      /* auto-fit rather than a fixed count: this row carries three fields on the
         header and six on a leg, and both should fill the width they are given
         instead of each needing its own breakpoint. */
      .ov-field-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 14px;
      }
      .ov-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
      .ov-field > span {
        font-size: 0.8125rem;
        color: var(--text-muted);
        letter-spacing: 0.01em;
      }
      .ov-field > span em {
        font-style: normal;
        opacity: 0.72;
      }
      .ov-field input,
      .ov-field select {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid var(--border);
        border-radius: 10px;
        background: var(--surface);
        color: var(--text);
        font: inherit;
        font-size: 0.9375rem;
        /* iOS zooms the page when a focused field is under 16px. These are
           0.9375rem = 15px, so the size is bumped on touch rather than letting
           the viewport jump on every tap. */
        transition: border-color 0.15s ease;
      }
      @media (pointer: coarse) {
        .ov-field input, .ov-field select { font-size: 1rem; }
      }
      .ov-field input:focus,
      .ov-field select:focus {
        outline: none;
        border-color: var(--accent);
      }
      /* Safari renders date inputs with a light UA background on dark grounds
         and a black glyph, which disappears against navy. */
      .ov-field input[type="date"] { color-scheme: dark; }

      .ov-leg {
        margin: 0 0 14px;
        padding: 16px 16px 4px;
        border: 1px solid var(--border);
        border-radius: 14px;
        background: var(--surface-alt);
      }
      .ov-leg__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
      }
      .ov-leg__n {
        font-size: 0.8125rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--gold);
      }
      .ov-leg__rm {
        padding: 0;
        border: 0;
        background: none;
        font: inherit;
        font-size: 0.8125rem;
        color: var(--text-muted);
        cursor: pointer;
      }
      .ov-leg__rm:hover { color: var(--accent); }
      .ov-leg__rm[hidden] { display: none; }
      /* Stock has no strike and no expiration of its own. Hidden rather than
         disabled so there is nothing on screen to wonder about. */
      .ov-leg.is-share .ov-field:has([data-f="k"]),
      .ov-leg.is-share .ov-field:has([data-f="x"]) { display: none; }

      .ov-model__actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 14px;
        margin: 22px 0 0;
      }
      .ov-btn-primary {
        padding: 12px 22px;
        border: 0;
        border-radius: 999px;
        background: var(--accent);
        color: var(--on-accent);
        font: inherit;
        font-size: 0.9375rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s ease, transform 0.15s ease;
      }
      .ov-btn-primary:hover { background: var(--accent-hover); transform: translateY(-1px); }
      .ov-btn-ghost {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 11px 20px;
        border: 1px solid var(--border);
        border-radius: 999px;
        background: none;
        color: var(--text-body);
        font: inherit;
        font-size: 0.9375rem;
        text-decoration: none;
        cursor: pointer;
        transition: border-color 0.15s ease, color 0.15s ease;
      }
      .ov-btn-ghost:hover { border-color: var(--accent); color: var(--accent); text-decoration: none; }
      .ov-btn-ghost[hidden] { display: none; }

      .ov-adv { margin: 26px 0 0; }
      .ov-adv summary {
        cursor: pointer;
        font-size: 0.9375rem;
        color: var(--text-muted);
        margin-bottom: 14px;
      }
      .ov-adv summary:hover { color: var(--accent); }

      .ov-model__err {
        margin: 18px 0 0;
        padding: 12px 14px;
        border: 1px solid var(--red, #C0554D);
        border-radius: 10px;
        background: rgba(192, 85, 77, 0.12);
        color: var(--text);
        font-size: 0.9375rem;
      }
      .ov-model__err[hidden] { display: none; }

      .ov-gate {
        max-width: 640px;
        padding: 24px;
        border: 1px solid var(--border);
        border-radius: 16px;
        background: var(--surface);
      }
      .ov-gate p { margin: 0; color: var(--text-body); }

      @media (max-width: 600px) {
        .ov-model__head { padding: 30px 0 22px; }
        .ov-leg { padding: 14px 14px 2px; }
      }

      ${getCarouselCSS()}
    </style>
  `;
}

// ===== LAYOUT WRAPPER =====
// ===== Motion =====
// Scroll reveal, the sticky CTA bar, and the one-time carousel nudge. Three rules
// govern all of it:
//   1. Nothing is hidden unless JS is running. Every reveal rule is gated on
//      html.motion-ready, which the inline head script adds. JS off -> the page
//      renders exactly as it did before, with no content stuck at opacity 0.
//   2. prefers-reduced-motion: reduce turns the whole thing off, at the same gate.
//   3. The hidden state is expressed in CSS, not applied by JS after load, so an
//      element is never painted visible and then yanked to transparent.

/// What fades+rises into view, as CSS selectors. Deliberately excludes h1, the
/// tagline and .tv-cta: the headline and the App Store button are above the fold and
/// must never depend on a script having run.
///
/// `.tv-copy > *` covers every direct child -- headings, paragraphs, lists alike --
/// rather than headings only. Animating just the headings meant each one slid in over
/// body text that was already sitting there at full opacity, which read as a glitch
/// rather than an effect. The script pairs each heading with the copy beneath it so a
/// block arrives as one piece; see getMotionScript.
const REVEAL_TARGETS = [
  '[data-reveal]',
  '.project-card',
  '.portfolio-embed',
  '.tv-band',
  '.tv-copy > *',
];

/// The subset the script observes one-by-one. Everything inside `.tv-copy` is handled
/// separately, grouped under its heading, so it is not listed here.
///
/// `[data-reveal]` marks a block that should arrive as one piece -- a whole work
/// entry, a whole section. The class selectors beside it are finer-grained than
/// that, and on the portfolio home they used to be the *only* matches: a heading
/// and its copy sat still while a PDF frame faded in underneath, which read as
/// nothing happening at all. Anything nested inside a reveal block is skipped by
/// the script, so marking a section does not double-animate the band inside it.
const REVEAL_STANDALONE = '[data-reveal], .project-card, .portfolio-embed, .tv-band';

/// `reveal: false` drops the scroll-reveal entirely for a page.
///
/// It is off on optionsvision.app because the reveal defeats the peek: the
/// landing page wants the Demo Videos band showing at the bottom of the first
/// viewport to invite the scroll, and a band that starts at opacity 0 until it
/// is scrolled to cannot peek at anything. The two ideas are mutually
/// exclusive, and the peek is worth more on a page whose job is conversion.
function getMotionStyles(reveal = true) {
  const transitions = REVEAL_TARGETS.map((s) => `html.motion-ready ${s}`).join(',\n      ');
  const hidden = REVEAL_TARGETS.map((s) => `html.motion-ready ${s}:not(.is-visible)`).join(',\n      ');
  // Emitting nothing rather than emitting an override: the rule that sets
  // opacity 0 must not exist at all, or a page with JS disabled would have no
  // way back from it.
  const revealCSS = !reveal ? '' : `
      /* --- Scroll reveal --- */
      /* 0.8s rather than the 0.55s this started at -- the quicker version read as a
         snap rather than a settle, especially on a desktop viewport where several
         blocks arrive at once. */
      ${transitions} {
        transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1),
                    transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
      }
      ${hidden} {
        opacity: 0;
        /* 26px, up from 18px. Now that a whole block arrives at once rather than
           a single embed, the shorter travel was easy to miss entirely. */
        transform: translateY(26px);
      }`;
  return `
    <style>
      /* =====================================================================
         Entrance framework
         =====================================================================
         Three layers, and which layer a thing belongs to is decided by one
         question: does it have to wait for anything?

           Layer 0  CHROME -- the nav and the sticky bar.
                    No animation at all. Structural, already in the HTML, needs
                    no network. It is painted on the first frame and never
                    hidden, so a refresh always lands on a complete top bar.
                    (The brand mark inside it still draws itself -- that is the
                    mark's own animation, not an entrance.)

           Layer 1  COPY -- the hero headline, subhead, CTA and proof list.
                    A short staggered rise, as a CSS animation with fill: both.
                    It starts when the element is PARSED, not when a script runs
                    and not when a resource lands, so it can never wait on the
                    network and there is no state a failure can strand it in.

           Layer 2  MEDIA -- the hero screenshot.
                    The only thing here whose arrival this page does not
                    control, so it is the only thing that fades on load rather
                    than on parse. Its frame reserves the space either way, so
                    nothing moves when it lands.

         This replaces a single fade over the whole body. That hid layer 0 along
         with everything else and held it until the screenshot resolved, so the
         nav -- which needs no loading whatsoever -- was blank and then flashed
         in with the rest of the page.

         Everything below is gated on motion-ready, so reduced-motion and JS-off
         visitors get the finished page with no entrance at all. */
      @keyframes ov-rise {
        from { opacity: 0; transform: translateY(14px); }
        to   { opacity: 1; transform: none; }
      }

      /* Layer 1. The delays are 70ms apart -- enough to read as a sequence
         rather than a single block, short enough that the whole hero has
         settled inside half a second. */
      html.motion-ready .ov-hero__title,
      html.motion-ready .ov-hero__sub,
      html.motion-ready .ov-hero__cta,
      html.motion-ready .ov-hero__proof,
      html.motion-ready .ov-hero__frame {
        animation: ov-rise 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      html.motion-ready .ov-hero__title { animation-delay: 0.04s; }
      html.motion-ready .ov-hero__sub   { animation-delay: 0.11s; }
      html.motion-ready .ov-hero__cta   { animation-delay: 0.18s; }
      html.motion-ready .ov-hero__proof { animation-delay: 0.25s; }
      /* The frame rides in alongside the copy rather than after it: it is half
         the composition, and holding it back left the hero visibly lopsided. */
      html.motion-ready .ov-hero__frame { animation-delay: 0.08s; }

      /* Layer 2. Opacity only -- the frame has already done the moving, and
         animating the image as well would slide it against its own container.
         Not a keyframe animation, because this one waits for an event. */
      html.motion-ready img.ov-fade-in {
        opacity: 0;
        transition: opacity 0.45s ease-out;
      }
      html.motion-ready img.ov-fade-in.is-loaded { opacity: 1; }
      ${revealCSS}

      /* --- Sticky CTA bar -----------------------------------------------------
         Slides down once the hero CTA has scrolled past. Not gated on
         motion-ready: it starts off-screen and only JS ever reveals it, so with
         JS off it simply never appears. Colours come from the theme tokens, so
         the same markup reads navy on optionsvision.app and light on the
         portfolio without a second stylesheet. */
      .tv-stickybar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 50;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 10px 20px;
        padding-left: max(20px, env(safe-area-inset-left));
        padding-right: max(20px, env(safe-area-inset-right));
        background: var(--stickybar-bg);
        border-bottom: 1px solid var(--border);
        transform: translateY(-100%);
        visibility: hidden;
        transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), visibility 0s 0.28s;
      }
      /* Progressive enhancement: translucent + blurred where supported, opaque
         where not. Declared after the solid fill so older engines keep that one. */
      @supports (backdrop-filter: blur(12px)) or (-webkit-backdrop-filter: blur(12px)) {
        .tv-stickybar {
          background: color-mix(in srgb, var(--stickybar-bg) 86%, transparent);
          -webkit-backdrop-filter: saturate(180%) blur(12px);
          backdrop-filter: saturate(180%) blur(12px);
        }
      }
      .tv-stickybar.is-stuck {
        transform: none;
        visibility: visible;
        transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), visibility 0s;
      }
      /* Serif and regular weight, the same face and weight the app's launch
         screen uses (LaunchView.swift, IowanOldStyle-Roman at .regular). The
         wordmark is one asset and should be one asset everywhere it appears.
         Bold is deliberately NOT used: Iowan Old Style's bold is a different
         cut, and where it is unavailable a browser synthesises one, which is
         exactly the "two serifs that merely resemble each other" the app's font
         handling was written to avoid.

         1.3rem -> 1.45rem to pay for the lost weight. A regular serif reads
         lighter than the bold sans this replaced, and next to bold sans nav
         links it needed the size back rather than a faux-bold. The name is
         allowed to ellipsis and the pill is flex: none, so growing it can never
         squeeze the tap target on a narrow screen. */
      .tv-stickybar__name {
        font-size: 1.45rem;
        color: var(--text);
        letter-spacing: -0.012em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      /* Only emitted when the bar is carrying the nav (the landing page). The
         wrapper keeps min-width: 0 so the name's ellipsis still works inside a
         flex row. */
      /* Centred, not flex-end. Bottom-aligning a 26px mark against a 33px text
         box dropped the mark's centre 9px below the wordmark's and hung it 5px
         past the text's bottom edge -- measured, and visible as a logo sitting
         in the gutter. Centring puts the two centres together; the 3px lift
         then sits it just above, which suits a mark whose ink is bottom-heavy
         and whose arrow reaches up. */
      .tv-stickybar__brand {
        display: flex;
        align-items: center;
        gap: 9px;
        min-width: 0;
      }
      /* The mark is 4:3, so width sets its height too. At 28px it read as an
         afterthought beside a 1.3rem bold wordmark, and 1px of lift left it
         sitting on the text box's descender line rather than on the baseline --
         which is what made it look dropped. 34px brings it near the nav's 36px,
         and 5px of lift puts its low point on the wordmark's baseline. */
      .tv-stickybar__brand .ov-mark {
        flex: 0 0 auto;
        width: 36px;
        margin-bottom: 3px;
      }
      .tv-stickybar__links {
        display: flex;
        gap: 26px;
        margin-left: auto;
      }
      .tv-stickybar__links a {
        color: var(--text-body);
        text-decoration: none;
        font-size: 0.9375rem;
        white-space: nowrap;
        transition: color 0.15s ease;
      }
      /* Matches the at-rest nav: bold and white on hover, never accent. The
         .ov-nav__reserve span inside each link holds the bold width, so the bar's
         items do not shuffle under the pointer either. */
      .tv-stickybar__links a:hover {
        color: var(--text);
        font-weight: 700;
        text-decoration: none;
      }
      /* Same breakpoint the at-rest nav drops its links at, so the bar never
         shows a set of links the page above it has already hidden. */
      @media (max-width: 860px) {
        .tv-stickybar__links { display: none; }
      }
      .tv-stickybar__cta {
        flex: none;
        display: inline-flex;
        align-items: center;
        background: var(--accent);
        color: var(--on-accent);
        text-decoration: none;
        font-size: 0.9rem;
        font-weight: 600;
        padding: 9px 16px;
        border-radius: 999px;
        white-space: nowrap;
        transition: background 0.2s ease;
      }
      .tv-stickybar__cta:hover { background: var(--accent-hover); }

      @media (prefers-reduced-motion: reduce) {
        .tv-stickybar, .tv-stickybar__cta { transition: none; }
      }

      /* Phones. The pill is the one thing here anybody taps, so it gets an
         explicit 44px minimum -- Apple's floor for a touch target. Padding alone
         left it around 34px, comfortably under. The name is allowed to ellipsis
         so the pill never gets squeezed on a narrow screen. */
      @media (max-width: 600px) {
        .tv-stickybar { padding: 6px 14px; gap: 10px; }
        .tv-stickybar__name { font-size: 1.32rem; }
        .tv-stickybar__cta {
          font-size: 0.85rem;
          padding: 8px 16px;
          min-height: 44px;
        }
      }
    </style>`;
}

/// The app's brand mark, ported from TrendMark / TrendArrowHead in
/// LaunchView.swift rather than traced from a screenshot -- both are pure
/// geometry over a 94x69 frame, so the coordinates below are the same numbers
/// the app computes at runtime. Stroke is 6pt with round caps and joins, in the
/// accent, exactly as the launch screen strokes it.
///
/// The viewBox is padded by 3 on every side because the stroke straddles the
/// path: half of a 6pt line hangs outside the 94x69 box at the start point, the
/// dip and the arrow tip. SwiftUI does not clip it there, and neither should
/// this -- without the padding the mark loses its outer edges.
const OV_TREND_MARK_SVG = `<svg class="ov-mark" viewBox="-3 -3 100 75" aria-hidden="true" focusable="false">
            <path class="ov-mark__line" pathLength="1"
                  d="M 0 37.95 L 31.02 69 L 58.28 22.08 L 74.81 11.862"
                  fill="none" stroke="var(--accent)" stroke-width="6"
                  stroke-linecap="round" stroke-linejoin="round" />
            <path class="ov-mark__arrow" d="M 94 0 L 80.978 21.841 L 68.642 1.883 Z" fill="var(--accent)" />
          </svg>`;

/// Pro badge. SF Symbol crown.fill is what the app marks gated features with
/// (LaunchView.swift), so the web uses a crown too rather than inventing a
/// second vocabulary for the same idea. Gold, matching the app's badge.
const OV_CROWN_SVG = `<svg class="ov-crown" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M2.6 8.1a1.1 1.1 0 0 1 1.72-.9l3.3 2.3 3.45-5.63a1.1 1.1 0 0 1 1.87 0l3.44 5.63 3.3-2.3a1.1 1.1 0 0 1 1.72.9l-1.06 8.2a1.5 1.5 0 0 1-1.49 1.31H5.15a1.5 1.5 0 0 1-1.49-1.31L2.6 8.1Z"/>
          </svg>`;

/// The nav's links, in one place because they are rendered twice: once in the
/// at-rest nav and once in the sticky bar that replaces it on scroll. Defined
/// here so the two can never drift apart.
///
/// "How it works" and "Strategies" were removed 2026-08-04. They were in-page
/// anchors on a one-page site, so they duplicated scrolling, and they were
/// hidden below 860px -- meaning they only ever existed for the visitors who
/// could scroll most easily. What is left are destinations.
///
/// The menu is a real disclosure, not a CSS-only hover: hover has no touch
/// equivalent and this is an iPhone app's landing page. Same pattern as the
/// strategy cards -- a button carrying aria-expanded, hover gated behind
/// (hover: hover), tap and keyboard driving the same class.
const OV_NAV_LINKS = `<div class="ov-nav__menuwrap">
          <button class="ov-nav__menubtn" type="button" aria-expanded="false" aria-controls="ovModelMenu">
            <span class="ov-nav__reserve" data-label="Model on the Web">Model on the Web</span>
            <svg class="ov-nav__caret" viewBox="0 0 10 6" aria-hidden="true" focusable="false"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <div class="ov-nav__menu" id="ovModelMenu">
            <a href="/model">
              <span class="ov-nav__menu-txt">
                <span class="ov-nav__menu-label">Manual Input</span>
                <span class="ov-nav__menu-desc">Enter a trade leg by leg</span>
              </span>
            </a>
            <a href="/model/import">
              <span class="ov-nav__menu-txt">
                <span class="ov-nav__menu-label">Import Robinhood Screenshot</span>
                <span class="ov-nav__menu-desc">Read it off your order ticket</span>
              </span>
              <span class="ov-nav__pro" title="OptionsVision Pro">${OV_CROWN_SVG}<span class="ov-vh"> (OptionsVision Pro)</span></span>
            </a>
          </div>
        </div>
        <a href="/resources"><span class="ov-nav__reserve" data-label="Resources">Resources</span></a>`;

/// Apple's official "Download on the App Store" badge, black, US/UK, pulled from
/// toolbox.marketingtools.apple.com. Apple asks that the badge be used as
/// supplied, so the paths are untouched -- the only edits are removing their
/// internal filename <title> (browsers show it as a tooltip) and the file's own
/// width/height so CSS can size it. Replaces a hand-drawn CSS pill that
/// approximated this; see the badge notes in getTradeVisionPageStyles.
const APP_STORE_BADGE_SVG = `<svg class="appstore-badge__svg" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 119.66407 40">
  <g>
    <g>
      <g>
        <path d="M110.13477,0H9.53468c-.3667,0-.729,0-1.09473.002-.30615.002-.60986.00781-.91895.0127A13.21476,13.21476,0,0,0,5.5171.19141a6.66509,6.66509,0,0,0-1.90088.627A6.43779,6.43779,0,0,0,1.99757,1.99707,6.25844,6.25844,0,0,0,.81935,3.61816a6.60119,6.60119,0,0,0-.625,1.90332,12.993,12.993,0,0,0-.1792,2.002C.00587,7.83008.00489,8.1377,0,8.44434V31.5586c.00489.3105.00587.6113.01515.9219a12.99232,12.99232,0,0,0,.1792,2.0019,6.58756,6.58756,0,0,0,.625,1.9043A6.20778,6.20778,0,0,0,1.99757,38.001a6.27445,6.27445,0,0,0,1.61865,1.1787,6.70082,6.70082,0,0,0,1.90088.6308,13.45514,13.45514,0,0,0,2.0039.1768c.30909.0068.6128.0107.91895.0107C8.80567,40,9.168,40,9.53468,40H110.13477c.3594,0,.7246,0,1.084-.002.3047,0,.6172-.0039.9219-.0107a13.279,13.279,0,0,0,2-.1768,6.80432,6.80432,0,0,0,1.9082-.6308,6.27742,6.27742,0,0,0,1.6172-1.1787,6.39482,6.39482,0,0,0,1.1816-1.6143,6.60413,6.60413,0,0,0,.6191-1.9043,13.50643,13.50643,0,0,0,.1856-2.0019c.0039-.3106.0039-.6114.0039-.9219.0078-.3633.0078-.7246.0078-1.0938V9.53613c0-.36621,0-.72949-.0078-1.09179,0-.30664,0-.61426-.0039-.9209a13.5071,13.5071,0,0,0-.1856-2.002,6.6177,6.6177,0,0,0-.6191-1.90332,6.46619,6.46619,0,0,0-2.7988-2.7998,6.76754,6.76754,0,0,0-1.9082-.627,13.04394,13.04394,0,0,0-2-.17676c-.3047-.00488-.6172-.01074-.9219-.01269-.3594-.002-.7246-.002-1.084-.002Z" style="fill: #a6a6a6"/>
        <path d="M8.44483,39.125c-.30468,0-.602-.0039-.90429-.0107a12.68714,12.68714,0,0,1-1.86914-.1631,5.88381,5.88381,0,0,1-1.65674-.5479,5.40573,5.40573,0,0,1-1.397-1.0166,5.32082,5.32082,0,0,1-1.02051-1.3965,5.72186,5.72186,0,0,1-.543-1.6572,12.41351,12.41351,0,0,1-.1665-1.875c-.00634-.2109-.01464-.9131-.01464-.9131V8.44434S.88185,7.75293.8877,7.5498a12.37039,12.37039,0,0,1,.16553-1.87207,5.7555,5.7555,0,0,1,.54346-1.6621A5.37349,5.37349,0,0,1,2.61183,2.61768,5.56543,5.56543,0,0,1,4.01417,1.59521a5.82309,5.82309,0,0,1,1.65332-.54394A12.58589,12.58589,0,0,1,7.543.88721L8.44532.875H111.21387l.9131.0127a12.38493,12.38493,0,0,1,1.8584.16259,5.93833,5.93833,0,0,1,1.6709.54785,5.59374,5.59374,0,0,1,2.415,2.41993,5.76267,5.76267,0,0,1,.5352,1.64892,12.995,12.995,0,0,1,.1738,1.88721c.0029.2832.0029.5874.0029.89014.0079.375.0079.73193.0079,1.09179V30.4648c0,.3633,0,.7178-.0079,1.0752,0,.3252,0,.6231-.0039.9297a12.73126,12.73126,0,0,1-.1709,1.8535,5.739,5.739,0,0,1-.54,1.67,5.48029,5.48029,0,0,1-1.0156,1.3857,5.4129,5.4129,0,0,1-1.3994,1.0225,5.86168,5.86168,0,0,1-1.668.5498,12.54218,12.54218,0,0,1-1.8692.1631c-.2929.0068-.5996.0107-.8974.0107l-1.084.002Z"/>
      </g>
      <g id="_Group_" data-name="&lt;Group&gt;">
        <g id="_Group_2" data-name="&lt;Group&gt;">
          <g id="_Group_3" data-name="&lt;Group&gt;">
            <path id="_Path_" data-name="&lt;Path&gt;" d="M24.76888,20.30068a4.94881,4.94881,0,0,1,2.35656-4.15206,5.06566,5.06566,0,0,0-3.99116-2.15768c-1.67924-.17626-3.30719,1.00483-4.1629,1.00483-.87227,0-2.18977-.98733-3.6085-.95814a5.31529,5.31529,0,0,0-4.47292,2.72787c-1.934,3.34842-.49141,8.26947,1.3612,10.97608.9269,1.32535,2.01018,2.8058,3.42763,2.7533,1.38706-.05753,1.9051-.88448,3.5794-.88448,1.65876,0,2.14479.88448,3.591.8511,1.48838-.02416,2.42613-1.33124,3.32051-2.66914a10.962,10.962,0,0,0,1.51842-3.09251A4.78205,4.78205,0,0,1,24.76888,20.30068Z" style="fill: #fff"/>
            <path id="_Path_2" data-name="&lt;Path&gt;" d="M22.03725,12.21089a4.87248,4.87248,0,0,0,1.11452-3.49062,4.95746,4.95746,0,0,0-3.20758,1.65961,4.63634,4.63634,0,0,0-1.14371,3.36139A4.09905,4.09905,0,0,0,22.03725,12.21089Z" style="fill: #fff"/>
          </g>
        </g>
        <g>
          <path d="M42.30227,27.13965h-4.7334l-1.13672,3.35645H34.42727l4.4834-12.418h2.083l4.4834,12.418H43.438ZM38.0591,25.59082h3.752l-1.84961-5.44727h-.05176Z" style="fill: #fff"/>
          <path d="M55.15969,25.96973c0,2.81348-1.50586,4.62109-3.77832,4.62109a3.0693,3.0693,0,0,1-2.84863-1.584h-.043v4.48438h-1.8584V21.44238H48.4302v1.50586h.03418a3.21162,3.21162,0,0,1,2.88281-1.60059C53.645,21.34766,55.15969,23.16406,55.15969,25.96973Zm-1.91016,0c0-1.833-.94727-3.03809-2.39258-3.03809-1.41992,0-2.375,1.23047-2.375,3.03809,0,1.82422.95508,3.0459,2.375,3.0459C52.30227,29.01563,53.24953,27.81934,53.24953,25.96973Z" style="fill: #fff"/>
          <path d="M65.12453,25.96973c0,2.81348-1.50586,4.62109-3.77832,4.62109a3.0693,3.0693,0,0,1-2.84863-1.584h-.043v4.48438h-1.8584V21.44238H58.395v1.50586h.03418A3.21162,3.21162,0,0,1,61.312,21.34766C63.60988,21.34766,65.12453,23.16406,65.12453,25.96973Zm-1.91016,0c0-1.833-.94727-3.03809-2.39258-3.03809-1.41992,0-2.375,1.23047-2.375,3.03809,0,1.82422.95508,3.0459,2.375,3.0459C62.26711,29.01563,63.21438,27.81934,63.21438,25.96973Z" style="fill: #fff"/>
          <path d="M71.71047,27.03613c.1377,1.23145,1.334,2.04,2.96875,2.04,1.56641,0,2.69336-.80859,2.69336-1.91895,0-.96387-.67969-1.541-2.28906-1.93652l-1.60937-.3877c-2.28027-.55078-3.33887-1.61719-3.33887-3.34766,0-2.14258,1.86719-3.61426,4.51855-3.61426,2.624,0,4.42285,1.47168,4.4834,3.61426h-1.876c-.1123-1.23926-1.13672-1.9873-2.63379-1.9873s-2.52148.75684-2.52148,1.8584c0,.87793.6543,1.39453,2.25488,1.79l1.36816.33594c2.54785.60254,3.60645,1.626,3.60645,3.44238,0,2.32324-1.85059,3.77832-4.79395,3.77832-2.75391,0-4.61328-1.4209-4.7334-3.667Z" style="fill: #fff"/>
          <path d="M83.34621,19.2998v2.14258h1.72168v1.47168H83.34621v4.99121c0,.77539.34473,1.13672,1.10156,1.13672a5.80752,5.80752,0,0,0,.61133-.043v1.46289a5.10351,5.10351,0,0,1-1.03223.08594c-1.833,0-2.54785-.68848-2.54785-2.44434V22.91406H80.16262V21.44238H81.479V19.2998Z" style="fill: #fff"/>
          <path d="M86.065,25.96973c0-2.84863,1.67773-4.63867,4.29395-4.63867,2.625,0,4.29492,1.79,4.29492,4.63867,0,2.85645-1.66113,4.63867-4.29492,4.63867C87.72609,30.6084,86.065,28.82617,86.065,25.96973Zm6.69531,0c0-1.9541-.89551-3.10742-2.40137-3.10742s-2.40039,1.16211-2.40039,3.10742c0,1.96191.89453,3.10645,2.40039,3.10645S92.76027,27.93164,92.76027,25.96973Z" style="fill: #fff"/>
          <path d="M96.18606,21.44238h1.77246v1.541h.043a2.1594,2.1594,0,0,1,2.17773-1.63574,2.86616,2.86616,0,0,1,.63672.06934v1.73828a2.59794,2.59794,0,0,0-.835-.1123,1.87264,1.87264,0,0,0-1.93652,2.083v5.37012h-1.8584Z" style="fill: #fff"/>
          <path d="M109.3843,27.83691c-.25,1.64355-1.85059,2.77148-3.89844,2.77148-2.63379,0-4.26855-1.76465-4.26855-4.5957,0-2.83984,1.64355-4.68164,4.19043-4.68164,2.50488,0,4.08008,1.7207,4.08008,4.46582v.63672h-6.39453v.1123a2.358,2.358,0,0,0,2.43555,2.56445,2.04834,2.04834,0,0,0,2.09082-1.27344Zm-6.28223-2.70215h4.52637a2.1773,2.1773,0,0,0-2.2207-2.29785A2.292,2.292,0,0,0,103.10207,25.13477Z" style="fill: #fff"/>
        </g>
      </g>
    </g>
    <g id="_Group_4" data-name="&lt;Group&gt;">
      <g>
        <path d="M37.82619,8.731a2.63964,2.63964,0,0,1,2.80762,2.96484c0,1.90625-1.03027,3.002-2.80762,3.002H35.67092V8.731Zm-1.22852,5.123h1.125a1.87588,1.87588,0,0,0,1.96777-2.146,1.881,1.881,0,0,0-1.96777-2.13379h-1.125Z" style="fill: #fff"/>
        <path d="M41.68068,12.44434a2.13323,2.13323,0,1,1,4.24707,0,2.13358,2.13358,0,1,1-4.24707,0Zm3.333,0c0-.97607-.43848-1.54687-1.208-1.54687-.77246,0-1.207.5708-1.207,1.54688,0,.98389.43457,1.55029,1.207,1.55029C44.57522,13.99463,45.01369,13.42432,45.01369,12.44434Z" style="fill: #fff"/>
        <path d="M51.57326,14.69775h-.92187l-.93066-3.31641h-.07031l-.92676,3.31641h-.91309l-1.24121-4.50293h.90137l.80664,3.436h.06641l.92578-3.436h.85254l.92578,3.436h.07031l.80273-3.436h.88867Z" style="fill: #fff"/>
        <path d="M53.85354,10.19482H54.709v.71533h.06641a1.348,1.348,0,0,1,1.34375-.80225,1.46456,1.46456,0,0,1,1.55859,1.6748v2.915h-.88867V12.00586c0-.72363-.31445-1.0835-.97168-1.0835a1.03294,1.03294,0,0,0-1.0752,1.14111v2.63428h-.88867Z" style="fill: #fff"/>
        <path d="M59.09377,8.437h.88867v6.26074h-.88867Z" style="fill: #fff"/>
        <path d="M61.21779,12.44434a2.13346,2.13346,0,1,1,4.24756,0,2.1338,2.1338,0,1,1-4.24756,0Zm3.333,0c0-.97607-.43848-1.54687-1.208-1.54687-.77246,0-1.207.5708-1.207,1.54688,0,.98389.43457,1.55029,1.207,1.55029C64.11232,13.99463,64.5508,13.42432,64.5508,12.44434Z" style="fill: #fff"/>
        <path d="M66.4009,13.42432c0-.81055.60352-1.27783,1.6748-1.34424l1.21973-.07031v-.38867c0-.47559-.31445-.74414-.92187-.74414-.49609,0-.83984.18213-.93848.50049h-.86035c.09082-.77344.81836-1.26953,1.83984-1.26953,1.12891,0,1.76563.562,1.76563,1.51318v3.07666h-.85547v-.63281h-.07031a1.515,1.515,0,0,1-1.35254.707A1.36026,1.36026,0,0,1,66.4009,13.42432Zm2.89453-.38477v-.37646l-1.09961.07031c-.62012.0415-.90137.25244-.90137.64941,0,.40527.35156.64111.835.64111A1.0615,1.0615,0,0,0,69.29543,13.03955Z" style="fill: #fff"/>
        <path d="M71.34816,12.44434c0-1.42285.73145-2.32422,1.86914-2.32422a1.484,1.484,0,0,1,1.38086.79h.06641V8.437h.88867v6.26074h-.85156v-.71143h-.07031a1.56284,1.56284,0,0,1-1.41406.78564C72.0718,14.772,71.34816,13.87061,71.34816,12.44434Zm.918,0c0,.95508.4502,1.52979,1.20313,1.52979.749,0,1.21191-.583,1.21191-1.52588,0-.93848-.46777-1.52979-1.21191-1.52979C72.72121,10.91846,72.26613,11.49707,72.26613,12.44434Z" style="fill: #fff"/>
        <path d="M79.23,12.44434a2.13323,2.13323,0,1,1,4.24707,0,2.13358,2.13358,0,1,1-4.24707,0Zm3.333,0c0-.97607-.43848-1.54687-1.208-1.54687-.77246,0-1.207.5708-1.207,1.54688,0,.98389.43457,1.55029,1.207,1.55029C82.12453,13.99463,82.563,13.42432,82.563,12.44434Z" style="fill: #fff"/>
        <path d="M84.66945,10.19482h.85547v.71533h.06641a1.348,1.348,0,0,1,1.34375-.80225,1.46456,1.46456,0,0,1,1.55859,1.6748v2.915H87.605V12.00586c0-.72363-.31445-1.0835-.97168-1.0835a1.03294,1.03294,0,0,0-1.0752,1.14111v2.63428h-.88867Z" style="fill: #fff"/>
        <path d="M93.51516,9.07373v1.1416h.97559v.74854h-.97559V13.2793c0,.47168.19434.67822.63672.67822a2.96657,2.96657,0,0,0,.33887-.02051v.74023a2.9155,2.9155,0,0,1-.4834.04541c-.98828,0-1.38184-.34766-1.38184-1.21582v-2.543h-.71484v-.74854h.71484V9.07373Z" style="fill: #fff"/>
        <path d="M95.70461,8.437h.88086v2.48145h.07031a1.3856,1.3856,0,0,1,1.373-.80664,1.48339,1.48339,0,0,1,1.55078,1.67871v2.90723H98.69v-2.688c0-.71924-.335-1.0835-.96289-1.0835a1.05194,1.05194,0,0,0-1.13379,1.1416v2.62988h-.88867Z" style="fill: #fff"/>
        <path d="M104.76125,13.48193a1.828,1.828,0,0,1-1.95117,1.30273A2.04531,2.04531,0,0,1,100.73,12.46045a2.07685,2.07685,0,0,1,2.07617-2.35254c1.25293,0,2.00879.856,2.00879,2.27V12.688h-3.17969v.0498a1.1902,1.1902,0,0,0,1.19922,1.29,1.07934,1.07934,0,0,0,1.07129-.5459Zm-3.126-1.45117h2.27441a1.08647,1.08647,0,0,0-1.1084-1.1665A1.15162,1.15162,0,0,0,101.63527,12.03076Z" style="fill: #fff"/>
      </g>
    </g>
  </g>
</svg>`;

/// A QR of APP_STORE_URL, lifted verbatim from share-page.html so the two
/// surfaces can never disagree. Static: regenerate both if that URL changes.
const APP_STORE_QR_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 37 37\"><path stroke=\"#000\" d=\"M4 4.5h7m1 0h1m2 0h2m1 0h1m2 0h3m2 0h7m-29 1h1m5 0h1m1 0h6m2 0h1m1 0h1m3 0h1m5 0h1m-29 1h1m1 0h3m1 0h1m5 0h2m1 0h2m1 0h3m1 0h1m1 0h3m1 0h1m-29 1h1m1 0h3m1 0h1m1 0h1m1 0h1m2 0h1m1 0h3m1 0h1m2 0h1m1 0h3m1 0h1m-29 1h1m1 0h3m1 0h1m5 0h1m2 0h1m1 0h1m1 0h1m2 0h1m1 0h3m1 0h1m-29 1h1m5 0h1m2 0h4m3 0h1m2 0h2m1 0h1m5 0h1m-29 1h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7m-21 1h1m6 0h5m-20 1h1m1 0h2m1 0h3m3 0h2m4 0h2m3 0h1m2 0h1m1 0h2m-28 1h1m1 0h2m2 0h1m1 0h2m3 0h1m4 0h4m1 0h1m3 0h1m-29 1h2m1 0h5m1 0h1m1 0h2m4 0h1m3 0h2m1 0h1m1 0h2m-25 1h1m1 0h1m1 0h1m5 0h2m1 0h1m11 0h1m-28 1h2m1 0h4m1 0h1m2 0h1m2 0h3m5 0h1m1 0h2m-25 1h2m4 0h1m3 0h1m1 0h2m1 0h3m2 0h1m3 0h3m-29 1h4m2 0h1m1 0h2m1 0h1m1 0h1m2 0h1m2 0h1m2 0h1m3 0h3m-29 1h3m2 0h1m1 0h1m2 0h1m1 0h1m3 0h1m1 0h3m3 0h1m2 0h1m-28 1h2m1 0h2m1 0h2m6 0h1m1 0h1m2 0h3m2 0h2m1 0h1m-25 1h3m2 0h1m1 0h1m4 0h3m3 0h1m1 0h1m1 0h3m-28 1h1m4 0h3m3 0h1m1 0h3m1 0h1m2 0h2m2 0h1m1 0h1m-25 1h1m1 0h2m1 0h2m1 0h1m2 0h2m2 0h2m4 0h1m2 0h1m-26 1h2m3 0h2m1 0h1m1 0h1m1 0h3m1 0h10m-19 1h1m1 0h1m1 0h1m4 0h2m1 0h1m3 0h5m-29 1h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h2m1 0h2m1 0h1m1 0h2m1 0h1m-28 1h1m5 0h1m1 0h1m1 0h1m2 0h3m2 0h1m1 0h1m3 0h2m1 0h1m-28 1h1m1 0h3m1 0h1m2 0h1m1 0h2m2 0h3m2 0h5m1 0h1m-27 1h1m1 0h3m1 0h1m1 0h2m1 0h1m3 0h1m1 0h1m2 0h2m2 0h2m2 0h1m-29 1h1m1 0h3m1 0h1m1 0h3m1 0h2m2 0h1m1 0h1m1 0h2m1 0h1m2 0h1m1 0h1m-29 1h1m5 0h1m2 0h5m2 0h1m1 0h1m1 0h2m1 0h3m1 0h1m-28 1h7m1 0h1m1 0h2m4 0h1m2 0h2m2 0h1m3 0h1\"/></svg>";

/// Markup for the sticky bar, plus the desktop download dialog. Only emitted on
/// the pages with a real call to action; the legal and support pages have none.
///
/// On a desktop the App Store link is close to useless -- it opens a web page
/// for an app the visitor cannot install on the machine in front of them. So on
/// a fine-pointer device the CTAs open this dialog instead: a QR to scan with
/// the phone, and the web listing still one click away for anyone who wants it.
/// Touch devices are untouched and follow the link straight through.
/// `links` makes this bar a continuation of the page's own nav rather than a
/// reduced stand-in for it. The landing page passes OV_NAV_LINKS, so what slides
/// in is the same wordmark, mark, links and CTA that scrolled off -- the bar
/// reads as the top of the page catching up, not as a second, sparser thing.
///
/// Guide pages pass nothing and keep the two-item bar: they have no nav to
/// continue, and their markup stays byte-for-byte what it was.
function getStickyBarHTML(label, href, links = '') {
  const brand = links
    ? `<span class="tv-stickybar__brand">
        <span class="tv-stickybar__name pf-serif">OptionsVision</span>
        ${OV_TREND_MARK_SVG}
      </span>
      <div class="tv-stickybar__links">${links}</div>`
    : `<span class="tv-stickybar__name pf-serif">OptionsVision</span>`;
  return `    <div class="tv-stickybar" id="tvStickyBar" aria-hidden="true">
      ${brand}
      <a class="tv-stickybar__cta" href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>
    </div>

    <div class="ov-dl" id="ovDl" hidden>
      <div class="ov-dl__card" role="dialog" aria-modal="true" aria-labelledby="ovDlTitle" tabindex="-1">
        <h2 class="ov-dl__title pf-serif" id="ovDlTitle">Get OptionsVision</h2>
        <p class="ov-dl__lede">Point your iPhone camera at the code to install it.</p>
        <div class="ov-dl__qr">${APP_STORE_QR_SVG}</div>
        <a class="ov-dl__cta" href="${href}" target="_blank" rel="noopener noreferrer">View on the App Store</a>
        <button class="ov-dl__close" type="button">Not now</button>
      </div>
    </div>

    <style>
      .ov-dl {
        position: fixed;
        inset: 0;
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(6, 12, 24, 0.72);
      }
      .ov-dl[hidden] { display: none; }
      @supports (backdrop-filter: blur(6px)) or (-webkit-backdrop-filter: blur(6px)) {
        .ov-dl { -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
      }
      .ov-dl__card {
        width: 100%;
        max-width: 340px;
        text-align: center;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 28px 26px 22px;
        box-shadow: 0 18px 48px var(--shadow);
      }
      .ov-dl__title {
        margin: 0 0 8px;
        font-size: 1.6rem;
        font-weight: 400;
        letter-spacing: -0.012em;
        color: var(--text);
      }
      .ov-dl__lede { margin: 0 0 18px; color: var(--text-body); font-size: 0.9375rem; }
      /* The code keeps a white field regardless of theme -- scanners need the
         light quiet zone, and inverting a QR breaks a good share of readers. */
      .ov-dl__qr {
        width: 190px;
        height: 190px;
        margin: 0 auto 20px;
        padding: 8px;
        background: #fff;
        border-radius: 10px;
      }
      .ov-dl__qr svg { display: block; width: 100%; height: 100%; }
      .ov-dl__cta {
        display: block;
        padding: 12px 20px;
        border-radius: 999px;
        background: var(--accent);
        color: var(--on-accent);
        font-size: 0.9375rem;
        font-weight: 600;
        text-decoration: none;
        transition: background 0.2s ease;
      }
      .ov-dl__cta:hover { background: var(--accent-hover); text-decoration: none; }
      .ov-dl__close {
        display: block;
        width: 100%;
        margin-top: 12px;
        padding: 8px;
        border: 0;
        background: none;
        color: var(--text-muted);
        font: inherit;
        font-size: 0.875rem;
        cursor: pointer;
      }
      .ov-dl__close:hover { color: var(--text); }
      @media (max-width: 380px) {
        .ov-dl__qr { width: 160px; height: 160px; }
      }
    </style>

    <script>
    (function () {
      var dl = document.getElementById('ovDl');
      if (!dl) return;
      // Coarse pointer means a phone or tablet, where the App Store link does
      // the right thing on its own. Only intercept on a fine pointer.
      if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;

      var card = dl.querySelector('.ov-dl__card');
      var lastFocus = null;

      function open(e) {
        e.preventDefault();
        lastFocus = document.activeElement;
        dl.hidden = false;
        card.focus();
      }
      function close() {
        dl.hidden = true;
        if (lastFocus && lastFocus.focus) lastFocus.focus();
      }

      // Delegated rather than bound per element: this block is emitted at the
      // top of the body, above the App Store badge, so querySelectorAll finds
      // nothing when it runs. The sticky bar sits just above it and bound fine,
      // which is exactly how this hid at first -- one CTA opened the dialog and
      // the other silently followed the link.
      document.addEventListener('click', function (e) {
        var el = e.target.closest && e.target.closest('.appstore-badge, .tv-stickybar__cta, .ov-nav__cta');
        if (el) open(e);
      });

      dl.querySelector('.ov-dl__close').addEventListener('click', close);
      dl.addEventListener('click', function (e) { if (e.target === dl) close(); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !dl.hidden) close();
      });
      // Following the real link should not leave the dialog open behind it.
      dl.querySelector('.ov-dl__cta').addEventListener('click', close);
    })();
    </script>`;
}

function getMotionScript(reveal = true) {
  return `
    <script>
    (function () {
      var standalone = ${JSON.stringify(REVEAL_STANDALONE)};
      var motion = document.documentElement.classList.contains('motion-ready');
      var hasIO = 'IntersectionObserver' in window;

      // --- Scroll reveal ---
      // Gated on the same flag as the CSS above. With the flag off there is no
      // rule hiding anything, so running the observer would only be busywork --
      // it would spend a frame per block adding a class that styles nothing.
      if (motion && ${reveal ? 'true' : 'false'}) {
        // A "unit" is one thing that arrives at once: a trigger element that gets
        // observed, plus every element revealed alongside it. Most units are a single
        // element. Inside .tv-copy a unit is a heading plus the paragraphs and lists
        // under it, up to the next heading -- so the block lands as one piece instead
        // of a heading animating over already-visible body text.
        var units = [];
        var attach = function (unit) {
          unit.trigger.__revealUnit = unit;
          units.push(unit);
        };

        [].slice.call(document.querySelectorAll(standalone)).forEach(function (n) {
          // Anything sitting inside another reveal block is carried by that
          // block's arrival, so it must not be observed separately -- observing
          // both animates the inner element a second time on top of its
          // parent's. It still matches the rule that hides un-revealed targets
          // though, so it has to be marked visible here and now. Skipping
          // without this left the home page's nested coverflow at opacity 0
          // permanently: 800px of blank navy where the videos should be.
          if (n.parentElement && n.parentElement.closest(standalone)) {
            n.classList.add('is-visible');
            return;
          }
          attach({ trigger: n, members: [n] });
        });

        [].slice.call(document.querySelectorAll('.tv-copy')).forEach(function (section) {
          var current = null;
          [].slice.call(section.children).forEach(function (el) {
            var startsBlock = el.tagName === 'H2' || el.tagName === 'H3';
            // Copy before the first heading (the intro paragraphs) forms its own unit.
            if (startsBlock || !current) {
              current = { trigger: el, members: [] };
              attach(current);
            }
            current.members.push(el);
          });
        });

        var showUnit = function (unit) {
          unit.members.forEach(function (n) { n.classList.add('is-visible'); });
        };
        var showAll = function () { units.forEach(showUnit); };
        if (!hasIO) {
          showAll();
        } else {
          // An observer delivers an initial callback for everything it observes,
          // intersecting or not, almost immediately. So "no callback at all" is a
          // precise signal that it is dead -- and the only case where we should
          // force everything visible. A blind timer would be wrong here: on this
          // page nothing is in view at scroll 0, so a visitor who reads the hero
          // for a few seconds would have the whole reveal fire behind their back.
          var delivered = false;
          var io = new IntersectionObserver(function (entries, obs) {
            delivered = true;
            entries.forEach(function (e) {
              if (!e.isIntersecting) return;
              var unit = e.target.__revealUnit;
              if (unit) showUnit(unit);
              obs.unobserve(e.target);
            });
          }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
          units.forEach(function (u) { io.observe(u.trigger); });
          setTimeout(function () { if (!delivered) showAll(); }, 4000);
        }
      }

      // --- Sticky CTA bar ---
      var bar = document.getElementById('tvStickyBar');
      // What the bar hands over FROM, in preference order.
      //
      // The at-rest .ov-nav first: the sticky bar is that nav's replacement, so
      // the handoff belongs exactly where the nav leaves the screen, and the
      // visitor is never without a CTA in reach. Keying off the hero's App Store
      // badge instead -- which is what this did -- held the bar back until the
      // badge had fully cleared the top, most of a viewport later, so the whole
      // hero scrolled by with no visible CTA at all.
      //
      // Guide pages have no nav, so they fall back to their own CTA. The
      // guard below is a bar && trigger test, so a miss fails silently.
      var trigger = document.querySelector('.ov-nav') ||
                    document.querySelector('.ov-hero__cta, .tv-cta');
      if (bar && trigger) {
        // A scroll listener rather than an observer, on purpose. This is a single
        // boolean derived from one element's position, the read is rAF-throttled so
        // it costs one getBoundingClientRect per frame at most, and unlike an
        // observer it can be verified anywhere. Comparing against the current class
        // first means no style write happens on the vast majority of frames.
        var ticking = false;
        var update = function () {
          ticking = false;
          // Stick once the trigger has fully passed the top edge -- never while
          // it is still below the fold on a short viewport.
          var stuck = trigger.getBoundingClientRect().bottom < 0;
          if (bar.classList.contains('is-stuck') === stuck) return;
          bar.classList.toggle('is-stuck', stuck);
          bar.setAttribute('aria-hidden', stuck ? 'false' : 'true');
        };
        var onScroll = function () {
          if (ticking) return;
          ticking = true;
          requestAnimationFrame(update);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });
        update();
      }

      // --- "Model on the Web" menu ---
      // There are two of these on the landing page -- the at-rest nav's and the
      // sticky bar's copy -- so this is delegated on document rather than bound
      // per element, and it is fine for there to be none at all.
      //
      // Hover opens the menu on a fine pointer, in CSS. This is the path for
      // everything else: touch, keyboard, and a click that pins it open.
      var MENU_BTN = '.ov-nav__menubtn';
      var setMenu = function (wrap, open) {
        wrap.classList.toggle('is-open', open);
        var b = wrap.querySelector(MENU_BTN);
        if (b) b.setAttribute('aria-expanded', open ? 'true' : 'false');
      };
      document.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest(MENU_BTN);
        var wraps = document.querySelectorAll('.ov-nav__menuwrap');
        for (var i = 0; i < wraps.length; i++) {
          // The clicked menu toggles; every other one closes, including on a
          // click that landed outside all of them.
          var mine = btn && wraps[i].contains(btn);
          setMenu(wraps[i], mine ? !wraps[i].classList.contains('is-open') : false);
        }
      });
      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        var open = document.querySelectorAll('.ov-nav__menuwrap.is-open');
        for (var i = 0; i < open.length; i++) {
          setMenu(open[i], false);
          var b = open[i].querySelector(MENU_BTN);
          if (b) b.focus();          // Escape should not strand focus in a closed menu
        }
      });

      // The walkthrough carousel used to step itself forward twice the first time
      // it scrolled into view. It now advances only when the reader asks it to --
      // arrows, dots, or clicking a grayed neighbour.
    })();
    </script>`;
}

function getLayout(title, content, additionalStyles = '', meta = {}) {
  // Optional SEO / social tags — only emitted when a value is supplied, so
  // pages that don't pass `meta` render exactly as before.
  // The <title> tag is written for a browser tab and a search result, which makes
  // it too long for a link preview. `socialTitle` is the short headline that sits
  // under the card image; it falls back to the page title when not supplied.
  const social = meta.socialTitle || title;
  const metaTags = [
    meta.description ? `<meta name="description" content="${meta.description}">` : '',
    meta.url ? `<link rel="canonical" href="${meta.url}">` : '',
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${social}">`,
    meta.description ? `<meta property="og:description" content="${meta.description}">` : '',
    meta.url ? `<meta property="og:url" content="${meta.url}">` : '',
    meta.image ? `<meta property="og:image" content="${meta.image}">` : '',
    // Declaring the intrinsic size lets clients reserve the wide card slot before
    // the image finishes downloading, instead of guessing and falling back small.
    // These MUST match the real file -- a client that trusts a wrong value and
    // then gets something else can drop back to the small card. Currently
    // public/tradevision/og-card.png is 1200x630, rasterized from og-card.pdf by
    // tools/rasterize-pdf.swift (vectors drawn at target size, not upscaled).
    meta.imageWidth ? `<meta property="og:image:width" content="${meta.imageWidth}">` : '',
    meta.imageHeight ? `<meta property="og:image:height" content="${meta.imageHeight}">` : '',
    meta.imageAlt ? `<meta property="og:image:alt" content="${meta.imageAlt}">` : '',
    meta.image ? `<meta name="twitter:card" content="summary_large_image">` : `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${social}">`,
    meta.description ? `<meta name="twitter:description" content="${meta.description}">` : '',
    meta.image ? `<meta name="twitter:image" content="${meta.image}">` : '',
    meta.imageAlt ? `<meta name="twitter:image:alt" content="${meta.imageAlt}">` : '',
    // Tints mobile browser chrome to match the navy ground. Both sites now.
    `<meta name="theme-color" content="#0E1B33">`,
    // Keeps unfinished pages out of search results. Draft strategy guides must not
    // be indexed under this domain before they have been edited and sourced.
    meta.noindex ? `<meta name="robots" content="noindex, nofollow">` : '',
    // Starts the LCP image downloading from the <head>, instead of waiting for
    // the parser to reach the <img> and lay it out. Only worth setting for an
    // image that is genuinely the largest above-the-fold paint -- preloading
    // anything else steals bandwidth from what is.
    //
    // `type` is what makes this safe to point at a .webp: a browser that cannot
    // decode the type skips the preload and falls through to the <picture>
    // element's own <img> fallback, rather than downloading both.
    meta.preloadImage ? `<link rel="preload" as="image" href="${meta.preloadImage}" type="${meta.preloadImageType || 'image/webp'}" fetchpriority="high">` : '',
  ].filter(Boolean).join('\n    ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    ${metaTags}
    ${getSharedStyles()}
    ${additionalStyles}
    ${getPortfolioHomeStyles()}
    ${getNavyComponentStyles()}
    ${/* After the navy component sheet on purpose: both define .tv-copy h3 at
         equal specificity, and the editorial eyebrow is the one that should
         win. Loaded before it, the sub-headings came out accent-cyan instead
         of gold, competing with the links around them. */''}
    ${getEditorialCopyStyles()}
    ${getMotionStyles(meta.reveal !== false)}
    ${getMobileStyles()}
    <script>
      // Opt in to motion before the first paint, so the reveal rules apply to the
      // initial render instead of flashing content in and then hiding it. Anything
      // that would leave content invisible is gated on this class, so a visitor
      // with JS off -- or one who has asked for reduced motion -- gets the plain,
      // fully visible page.
      if (!window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.documentElement.classList.add('motion-ready');

        // --- Entrance, layer 2 only: media that arrives on the network ---
        //
        // Layers 0 and 1 (chrome and copy -- see getMotionStyles) are pure CSS
        // and need no help: they start on parse and cannot wait on anything.
        // The hero screenshot is the one element whose arrival time this page
        // does not control, so it is the only one JS touches.
        //
        // The timeout is registered FIRST, before anything that could throw, and
        // sweeps in every marked image unconditionally. It is the guarantee that
        // a failure below -- or a connection slow enough that waiting would mean
        // staring at a hole -- can never leave the image invisible.
        var show = function (el) { el.classList.add('is-loaded'); };
        var sweep = function () {
          var all = document.querySelectorAll('.ov-fade-in');
          for (var i = 0; i < all.length; i++) show(all[i]);
        };
        setTimeout(sweep, 1200);

        document.addEventListener('DOMContentLoaded', function () {
          var imgs = document.querySelectorAll('img.ov-fade-in');
          for (var i = 0; i < imgs.length; i++) {
            (function (img) {
              // An image served from cache can finish before this listener is
              // attached, and then the load event never comes. Check first.
              if (img.complete) return show(img);
              img.addEventListener('load', function () { show(img); });
              img.addEventListener('error', function () { show(img); });
            })(imgs[i]);
          }
        });
      }
    </script>
</head>
<body>
    ${content}
    ${getMotionScript(meta.reveal !== false)}
</body>
</html>`;
}

// ===== Phone-only layout tweaks =====
// Loaded LAST in <head> so, at equal specificity, these win over the desktop
// rules above. Everything is scoped inside @media (max-width: 600px), so the
// laptop/desktop layout is byte-for-byte unchanged — this only applies to phones
// (and any window narrowed below 600px).
function getMobileStyles() {
  return `
    <style>
      @media (max-width: 600px) {
        /* Never let the page scroll sideways: clip the fanned coverflow neighbors
           (the real source of the horizontal overflow) + a body-level safety net. */
        body { overflow-x: hidden; }
        .tv-cf-stage { overflow-x: hidden; }

        /* Neighbor videos get clipped on phones, so restore the prev/next arrows
           as the way to change videos. (Loaded last, so this wins the display:none above.) */

        /* Comfortable edge padding on small screens */
        .container { padding-left: 16px; padding-right: 16px; padding-top: 28px; }

        /* Headings scaled down a step so long titles don't dominate the screen */
        h1 { font-size: 34px; }
        h2 { font-size: 24px; }
        .tagline { font-size: 18px; }
      }
    </style>`;
}

// ===== PAGE FUNCTIONS =====
/// The Sources Tracker product page. Was a standalone <html> document with its
/// own white stylesheet, which is why it did not follow the navy retheme; it now
/// renders through getLayout() like everything else, so it inherits the shared
/// tokens, the scroll reveal and the mobile rules. Content is unchanged.
///
/// The copy sits in a `.tv-copy` wrapper on purpose: the reveal script groups
/// that container's children under their headings, so a section arrives as one
/// piece instead of a heading animating over its own body text.
function getSourcesTrackerHomepageHTML() {
  return getLayout('Sources Tracker for Google Slides\u2122 \u2014 Vishnu Muthiah', `
    <div class="pf-page st-page">
      <a href="/" class="st-back">&larr; Back to home</a>

      <div class="tv-copy">
        <h1>Automatically keep track of every source, citation, and link in your presentations.</h1>

              <div class="pf-embed"><div class="pf-frame pf-video"><iframe src="https://www.youtube.com/embed/Z7QSvFDqXjM" title="Sources Tracker for Google Slides demo" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div></div>

              <p style="font-size: 18px; margin-bottom: 24px;"><a href="https://workspace.google.com/marketplace/app/sources_tracker_for_google_slides/979571123439">Sources Tracker</a> is now available for free download on the Google Workspace Marketplace!</p>

              <h2>How It Works</h2>

              <h3>All Your Sources in One View</h3>
              <p>
                The Sources Tracker sidebar automatically detects and organizes every link, file,
                and embedded resource in your Google Slides™ presentation.
                </p>
                <p>
                Manage Google Docs™, Google Sheets™, PDFs, YouTube videos, Excel files, and other file types in a clean, structured list.
              </p>

              <p><strong>What you get:</strong></p>
              <ul>
                <li>Automatic source detection across your entire deck</li>
                <li>Organized cards showing file type, title, and location</li>
                <li>Slide by slide navigation to jump to any source instantly</li>
                <li>One click scanning to update your source list</li>
              </ul>

              <p>
                Perfect for research presentations, investor decks, and collaborative projects.
              </p>

              <h2>Overview of Sidebar Functionality</h2>
               <img
                src="/sources-tracker/screenshot.png"
                alt="Sources Tracker sidebar integrated into Google Slides"
              />
              <p>
                This view shows the full Sources Tracker sidebar integrated directly into Google Slides™.
                The panel automatically detects all embedded sources on a slide including Google Docs™,
                Google Sheets™, Microsoft Excel files, Microsoft Word files, PDFs, YouTube videos, links,
                and other file types in a structured list.
              </p>

              <p>
                Each source card includes metadata, links, discussions, and navigation controls.
                The sidebar also provides a slide by slide index on the left, allowing users to jump
                between slides with comments or sources. At the top, users can click "Generate Summary
                File" to run a full deck scan and generate a summary file in Google Sheets™.
              </p>

              <p>
                This view demonstrates the add-on's core value: bringing all citations, artifacts,
                and discussions into a unified workspace inside Google Slides™.
              </p>

              <h2>Export a Complete Summary in Seconds</h2>
              <p>
                Generate a comprehensive Google Sheets™ report of every source in your presentation
                with a single click.
              </p>

              <p><strong>Your export includes:</strong></p>
              <ul>
                <li>Every URL with its title and file type</li>
                <li>Which slides contain each source</li>
                <li>All discussion threads and comments</li>
                <li>Audit ready format for compliance and review</li>
              </ul>

              <p>
                Ideal for handoffs, documentation, and quality assurance.
              </p>

              <h2>Find Every Use of a Source Across Your Deck</h2>
              <p>
                Click any source to instantly see every slide where it appears. Sources Tracker highlights
                all slides using that link in gold, showing you exactly where your data, analysis,
                or citations are referenced.
              </p>

              <p><strong>Why this matters:</strong></p>
              <ul>
                <li>Prevent inconsistencies across large presentations</li>
                <li>Ensure updates propagate everywhere</li>
                <li>Quickly audit which slides use specific data sources</li>
                <li>Maintain consistency in multi-author decks</li>
              </ul>

              <h2>Track Discussions Tied to Specific Sources</h2>
              <p>
                Add comments directly to sources, not just slides. Keep feedback organized and actionable
                with threaded discussions that stay connected to the exact file or link being discussed.
              </p>

              <p><strong>Comment features:</strong></p>
              <ul>
                <li>Thread replies to keep conversations organized</li>
                <li>Resolve and unresolve comments with visual indicators</li>
                <li>Hide resolved comments to reduce clutter</li>
                <li>See comment history for every source</li>
              </ul>

              <p>
                Great for team collaboration and stakeholder feedback.
              </p>

              <h2>Drag to Reorder and See Source Frequency</h2>
              <p>
                Keep your sources organized exactly how you want them. Drag and drop to reorder,
                and see at a glance when a source appears multiple times on the same slide.
              </p>

              <p><strong>Quality Control Features:</strong></p>
              <ul>
                <li>Visual badges showing how many times a source appears</li>
                <li>Easy reordering with drag and drop</li>
                <li>Automatic duplicate detection</li>
                <li>Clean, organized source lists</li>
              </ul>

              <p><strong>Why Sources Tracker:</strong></p>
              <ul>
                <li>Save time by eliminating manual link tracking</li>
                <li>Stay organized with all sources and discussions in one place</li>
                <li>Collaborate better with comments tied to specific sources</li>
                <li>Ensure quality by finding inconsistencies across your deck</li>
                <li>Privacy first. Your data never leaves Google's infrastructure</li>
              </ul>

              <p><strong>Get Started:</strong></p>
               <ol>
                 <li>Install Sources Tracker from the Google Workspace Marketplace</li>
                 <li>Open any Google Slides™ presentation</li>
                 <li>Go to Extensions > Sources Tracker > Scan Deck</li>
                 <li>Your sidebar appears with all sources automatically detected</li>
               </ol>
               <p><strong>Perfect For:</strong></p>
              <ul>
                <li>Research teams managing citations and data sources</li>
                <li>Consulting firms tracking client deliverables and references</li>
                <li>Academic presentations with multiple citations</li>
                <li>Executive decks requiring audit trails</li>
                <li>Collaborative projects with multiple contributors</li>
              </ul>

              <p><strong>Privacy, Security, and Terms of Service:</strong></p>
              <ul>
                <li>Minimal permissions. Only accesses your current presentation</li>
                <li>No data sharing with third parties</li>
                <li>All data stored in Google's secure infrastructure</li>
                <li>You control your data and can delete it anytime</li>
              </ul>

              <p>
                <a href="/privacy-policy">Read our Privacy Policy →</a><br />
                <a href="/terms-of-service">Read our Terms of Service →</a>
              </p>

              <h2>Support</h2>
              <p>
                Questions or need help?<br />
                📧 Email: <a href="mailto:VishnuAMuthiah@gmail.com">VishnuAMuthiah@gmail.com</a><br />
                ⏱️ Response time: 48 to 72 hours
              </p>
      </div>

      <footer class="pf-foot">
        <p>&copy; 2026 Vishnu Muthiah. All rights reserved.</p>
        <p><a href="/">Home</a> &nbsp;&middot;&nbsp; <a href="/privacy-policy">Privacy Policy</a> &nbsp;&middot;&nbsp; <a href="/terms-of-service">Terms of Service</a></p>
      </footer>
    </div>
  `, '', {
    description: 'Automatically track every source, citation, and link in your Google Slides presentations.',
    url: 'https://vishnumuthiah.com/sources-tracker',
  });
}

/// Typographic treatment for the Sources Tracker page, matching the home page:
/// serif headings, gold sub-eyebrows, accent list markers. Scoped under
/// `.st-page` so it cannot reach the product site's own `.tv-copy` pages.
/// Editorial typography for long-form copy: serif headings over a hairline,
/// gold sub-headings that read as eyebrows, accent list markers. Scoped to
/// .tv-copy, which every optionsvision.app page and the Sources Tracker page
/// already wrap their prose in -- so this is what makes the product site match
/// the portfolio without touching each page's markup. Injected from getLayout,
/// and inert on any page with no .tv-copy.
function getEditorialCopyStyles() {
  return `
    <style>
      /* No text-wrap: balance here. It evens the line lengths, which on a
         heading like "How It Works: Screenshot to Interactive Chart in Seconds"
         broke the first line well short of the column and left it looking
         narrower than the body text underneath. These fill the measure. */
      .tv-copy h1,
      .tv-copy h2 {
        font-family: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", ui-serif, Georgia, serif;
        font-weight: 400;
        color: var(--text);
      }
      .tv-copy h1 {
        font-size: clamp(2rem, 5vw, 3.15rem);
        line-height: 1.1;
        letter-spacing: -0.018em;
        margin: 0 0 28px;
      }
      .tv-copy h2 {
        font-size: clamp(1.4rem, 3.2vw, 1.85rem);
        line-height: 1.25;
        letter-spacing: -0.012em;
        margin: 42px 0 13px;
        padding-top: 22px;
        border-top: 1px solid var(--border);
      }
      /* Sub-headings read as eyebrows rather than smaller titles. Gold keeps
         them clear of the accent, which on these pages means "this is a link".
         Set at 1rem -- body size -- rather than the 11px caption they started
         at; tracking comes down to suit, since uppercase needs far less of it
         at 16px than at 11. */
      .tv-copy h3 {
        font-size: 1rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        font-weight: 600;
        color: var(--gold);
        margin: 27px 0 10px;
      }
      /* No max-width: prose runs the full column, the same measure the demo
         bands use, so every block on the page shares one left and right edge. */
      .tv-copy p { margin: 0 0 15px; }
      .tv-copy ul,
      .tv-copy ol { margin: 0 0 20px 0; padding-left: 18px; }
      .tv-copy li { margin-bottom: 6px; }
      .tv-copy li::marker { color: var(--accent); }
      .tv-copy img {
        display: block;
        max-width: 100%;
        height: auto;
        margin: 20px 0 22px;
        border: 1px solid var(--border);
        border-radius: 8px;
      }
      /* The band titles inside .tv-copy are component chrome, not prose, so they
         are exempt from the eyebrow treatment above. 28px matches the Demo
         Videos band, whose title sits outside .tv-copy and never picked up the
         eyebrow rule -- the two bands are siblings and should read as a pair. */
      .tv-copy .tv-walkthrough h3,
      .tv-copy .tv-band-title {
        font-size: 28px;
        letter-spacing: 0.01em;
        text-transform: none;
      }
      /* Both band titles sat in a 44.8px line box -- body line-height of 1.6
         applied to a 28px face -- on top of a 22px margin, which read as about
         50px of dead space under the heading. The selectors are written to
         out-specify .tv-copy .tv-walkthrough h3 (0,2,1) in
         getTradeVisionPageStyles and .tv-band-title in getCarouselCSS; this
         sheet also loads last, so both tie-breaks land here. */
      .tv-band-title,
      .tv-copy .tv-walkthrough h3 {
        line-height: 1.2;
        margin-bottom: 10px;
      }
      /* Both bands open with the same lid. .tv-band carried 29px of padding-top
         from getCarouselCSS while .tv-walkthrough had 14px -- that asymmetry is
         what made the space above "Demo Videos" read as larger than the one
         above "Demo Walkthrough" even though the titles matched. The 6px above
         the walkthrough carousel goes too, so both run title -> 10px -> media. */
      .tv-band { padding-top: 14px; }
      .tv-walkthrough .tv-carousel { margin-top: 0; }

      .st-back {
        display: inline-block;
        margin: 32px 0 34px;
        font-size: 0.8125rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text-muted);
      }
      .st-back:hover { color: var(--accent); }
      .st-page .pf-foot { margin-top: 36px; }
    </style>
  `;
}



function getHomepageHTML() {
  return getLayout('Vishnu Muthiah - Strategist & Builder', `
    <div class="pf-page">

      <header class="pf-hero">
        <p class="pf-name">Vishnu Muthiah</p>
        <h1 class="pf-serif">Strategist &amp; Builder</h1>
        <p class="pf-sub">Nine years in strategy and technology consulting, now combined with hands-on product development to build tools that solve real problems.</p>
        <div class="pf-actions">
          <a class="pf-pill" href="mailto:VishnuAMuthiah@gmail.com">Get in touch</a>
          <a class="pf-quiet" href="#work" data-scroll>or see what I've built &rarr;</a>
        </div>
      </header>

      <section id="work">
        <p class="pf-label" data-reveal>Selected work</p>

        <article class="pf-entry" data-reveal>
          <p class="pf-kind">iOS &middot; options analytics</p>
          <div class="ov-lockup ov-lockup--entry">
            <h3 class="pf-serif"><a href="https://optionsvision.app" target="_blank" rel="noopener noreferrer">OptionsVision</a></h3>
            ${OV_TREND_MARK_SVG}
          </div>
          <p class="pf-desc">Take a screenshot of your Robinhood order and watch it become an interactive P&amp;L chart. Model different scenarios by adjusting your days to expiration and your implied volatility. Then analyze your Greeks and break-evens, all privately on your device.</p>

${getDemoVideosHTML()}

          <div class="pf-links">
            <a href="https://optionsvision.app" target="_blank" rel="noopener noreferrer">Visit optionsvision.app &rarr;</a>
          </div>
        </article>

        <article class="pf-entry" data-reveal>
          <p class="pf-kind">Google Workspace Sources Tool</p>
          <h3 class="pf-serif"><a href="/sources-tracker">Sources Tracker for Google Slides&trade;</a></h3>
          <p class="pf-desc">Automatically detects and organizes citations, links, and references in presentations &mdash; source detection, threaded comments, cross-slide tracking, and exportable summaries.</p>

          <div class="pf-embed">
            <div class="pf-frame pf-video">
              <iframe src="https://www.youtube.com/embed/Z7QSvFDqXjM" title="Sources Tracker for Google Slides demo" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
            </div>
          </div>

          <div class="pf-links">
            <a href="/sources-tracker">Read more &rarr;</a>
            <a href="https://workspace.google.com/marketplace/app/sources_tracker_for_google_slides/979571123439" target="_blank" rel="noopener noreferrer">Install &rarr;</a>
            <a href="/support">Support &rarr;</a>
          </div>
        </article>

        <article class="pf-entry" data-reveal>
          <p class="pf-kind">Writing</p>
          <h3 class="pf-serif">Consulting Case Interview Mental Model</h3>
          <p class="pf-desc">A mental model for building the framework to tackle any consulting case interview.</p>

          <div class="pf-embed">
            <div class="pf-frame">
              <iframe src="https://drive.google.com/file/d/1FxHmnqk2j1rpzcNAYWlfcmt7LVCOY60r/preview" title="Case Interview Mental Model PDF" loading="lazy" allow="autoplay" allowfullscreen></iframe>
            </div>
          </div>

          <div class="pf-links">
            <a href="/sources-tracker/case-interview-mental-model.pdf" target="_blank" rel="noopener noreferrer">Download PDF &rarr;</a>
          </div>
        </article>

        <article class="pf-entry" data-reveal>
          <p class="pf-kind">Background</p>
          <h3 class="pf-serif">Professional Bio</h3>
          <p class="pf-desc">An overview of my experience, key projects, and capabilities across strategy consulting, product management, and software development.</p>

          <div class="pf-embed">
            <div class="pf-frame">
              <iframe src="https://drive.google.com/file/d/1wIy3K3nzAfCEweJIBcULe-5jm-aiJ8we/preview" title="Professional Bio PDF" loading="lazy" allow="autoplay" allowfullscreen></iframe>
            </div>
          </div>

          <div class="pf-links">
            <a href="/professional-bio.pdf" target="_blank" rel="noopener noreferrer">Download PDF &rarr;</a>
          </div>
        </article>
      </section>

      <section class="pf-tight" data-reveal>
        <p class="pf-label">Experience</p>

        <div class="pf-cv">
          <h3>Professional</h3>
          <div class="pf-row">
            <p class="pf-year pf-mono">2022&ndash;2025</p>
            <p class="pf-role pf-serif">Senior Strategy Consultant<span class="pf-org">Accenture Strategy</span></p>
          </div>
          <div class="pf-row">
            <p class="pf-year pf-mono">2016&ndash;2020</p>
            <p class="pf-role pf-serif">Microsoft Enterprise Technology Consultant<span class="pf-org">IBM</span></p>
          </div>
        </div>

        <div class="pf-cv">
          <h3>Education</h3>
          <div class="pf-row">
            <p class="pf-year pf-mono">2020&ndash;2022</p>
            <p class="pf-role pf-serif">MBA<span class="pf-org">University of Michigan, Ross School of Business</span></p>
          </div>
          <div class="pf-row">
            <p class="pf-year pf-mono">2012&ndash;2016</p>
            <p class="pf-role pf-serif">BS, Systems Engineering &amp; Economics<span class="pf-org">University of Virginia</span></p>
          </div>
        </div>
      </section>

      <section class="pf-tight" data-reveal>
        <p class="pf-label">Contact</p>
        <p class="pf-contact pf-serif"><a href="mailto:VishnuAMuthiah@gmail.com">VishnuAMuthiah@gmail.com</a></p>
        <p class="pf-contact pf-serif"><a href="https://www.linkedin.com/in/vishnumuthiah" target="_blank" rel="noopener noreferrer">LinkedIn</a></p>
      </section>

      <footer class="pf-foot" data-reveal>
        <p>&copy; 2026 Vishnu Muthiah. All rights reserved.</p>
        <p><a href="/privacy-policy">Privacy Policy</a> &nbsp;&middot;&nbsp; <a href="/terms-of-service">Terms of Service</a></p>
      </footer>

    </div>

    <script>
      // Smooth-scroll the one in-page link, and move focus with it so the jump
      // is not keyboard-only-hostile. CSS scroll-behavior handles the motion;
      // this exists to set focus and to respect reduced-motion explicitly.
      document.querySelectorAll('[data-scroll]').forEach(function (a) {
        a.addEventListener('click', function (e) {
          var target = document.querySelector(a.getAttribute('href'));
          if (!target) return;
          e.preventDefault();
          var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
          target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
        });
      });
    </script>
    ${getDemoVideosScript()}
  `, `<style>${getCarouselCSS()}</style>`);
}

/// Layout for the redesigned portfolio home (2026-07-26). Everything here is
/// scoped to `.pf-*` so it cannot reach the legal, support or product pages,
/// which still use the generic element rules in getSharedStyles().
///
/// The structure is deliberately typographic rather than card-based: an
/// oversized serif headline, hairline-ruled rows, and one filled CTA. The serif
/// is a system stack -- Iowan Old Style ships on macOS/iOS and is what this was
/// designed against; the Palatino and Georgia fallbacks carry other platforms.
function getPortfolioHomeStyles() {
  return `
    <style>
      .pf-page {
        max-width: 736px;
        margin: 0 auto;
        padding: 0 28px 64px;
      }
      .pf-serif {
        font-family: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", ui-serif, Georgia, serif;
      }
      .pf-mono {
        font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
      }

      /* ---- Hero ----
         getSharedStyles() styles the bare header element with a 3px accent
         rule and a bottom margin, for the old card layout. This is a <header>,
         so it inherited both: a heavy cyan bar sat under the CTA, directly
         above the first section's own hairline. Reset explicitly rather than
         renaming the element -- <header> is the right tag for this content. */
      .pf-hero {
        padding: 38px 0 45px;
        border-bottom: 0;
        margin-bottom: 0;
      }
      /* The name is a masthead, not a caption. Tracking comes down as the size
         goes up: uppercase at 32px needs far less of it than at 11px. */
      .pf-name {
        font-size: clamp(1.35rem, 3.6vw, 2rem);
        line-height: 1.15;
        letter-spacing: 0.075em;
        text-transform: uppercase;
        color: var(--gold);
        margin: 0 0 18px;
      }
      .pf-hero h1 {
        margin: 0;
        font-size: clamp(2.75rem, 7.5vw, 4.5rem);
        line-height: 1.04;
        letter-spacing: -0.021em;
        font-weight: 400;
        color: var(--text);
        text-wrap: balance;
      }
      /* Classed rather than a .pf-hero p rule: an element selector there would
         out-specify .pf-name and repaint the masthead in body colour. */
      .pf-sub {
        margin: 21px 0 0;
        color: var(--text-body);
        font-size: 1.0625rem;
      }
      /* Wordmark left, brand mark flushed to the right edge of the column, both
         on one row. Baseline-aligned rather than centred: the mark's visual
         weight sits low, so centring it against a 72px serif left it floating. */
      .ov-lockup {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
      }
      .ov-lockup h1 { margin: 0; }
      .ov-mark {
        flex: 0 0 auto;
        width: 94px;
        height: auto;
        /* Nudged off the baseline so the arrow tip clears the cap height. */
        margin-bottom: 6px;
      }
      @media (max-width: 600px) {
        .ov-mark { width: 68px; margin-bottom: 4px; }
        .ov-lockup { gap: 14px; }
      }

      /* In a work entry the mark sits beside a ~30px heading rather than a 72px
         one, so it comes down to suit. */
      .ov-lockup--entry .ov-mark { width: 46px; margin-bottom: 3px; }
      @media (max-width: 600px) {
        .ov-lockup--entry .ov-mark { width: 40px; }
      }

      /* Hold the draw until the block it lives in has actually arrived. In the
         hero nothing gates it, so it plays on load. Inside a [data-reveal] entry
         the block starts at opacity 0 -- without this the whole sequence would
         run unseen during page load and a reader scrolling down would find a
         mark that had already drawn itself. Paused from the first frame at
         currentTime 0, so it resumes from the beginning when .is-visible lands. */
      html.motion-ready [data-reveal]:not(.is-visible) .ov-mark,
      html.motion-ready [data-reveal]:not(.is-visible) .ov-mark__line,
      html.motion-ready [data-reveal]:not(.is-visible) .ov-mark__arrow {
        animation-play-state: paused;
      }

      /* ---- Mark animation, ported from LaunchView.swift onAppear ----
         Three steps on the app's own curves and clocks:
           the mark fades in while rising 10pt   easeOut 0.26s, no delay
           the line strokes itself in            easeOut 0.8s  after 0.05s
           the arrowhead pops in at the tip      easeOut 0.15s after 0.85s
         In SwiftUI the line is a trim(from:to:) sweep; here it is a dash
         offset, with pathLength="1" on the path so the sweep is expressed in
         0..1 and needs no measured length.

         The arrowhead scales from 0.6 anchored .topTrailing. On this artwork
         that corner IS the arrow tip -- the triangle's bbox top-right is
         (94, 0), the tip itself -- so fill-box with a top-right origin
         reproduces it: the tip holds still and the head grows out of it.

         Gated on html.motion-ready, the class getLayout only adds when the
         visitor has not asked for reduced motion. So reduced motion, or no
         JS, gets the finished mark with no dash offset and no transform --
         which is exactly what the app does on its reduceMotion branch. */
      html.motion-ready .ov-mark {
        animation: ov-mark-in 0.26s ease-out both;
      }
      html.motion-ready .ov-mark__line {
        stroke-dasharray: 1;
        stroke-dashoffset: 1;
        animation: ov-mark-draw 0.8s ease-out 0.05s forwards;
      }
      html.motion-ready .ov-mark__arrow {
        opacity: 0;
        transform: scale(0.6);
        transform-box: fill-box;
        transform-origin: 100% 0%;
        animation: ov-mark-arrow 0.15s ease-out 0.85s forwards;
      }
      @keyframes ov-mark-in {
        from { opacity: 0; transform: translateY(10px); }
        to   { opacity: 1; transform: none; }
      }
      @keyframes ov-mark-draw {
        to { stroke-dashoffset: 0; }
      }
      @keyframes ov-mark-arrow {
        to { opacity: 1; transform: scale(1); }
      }

      /* Retained as a no-op hook: every block now runs the full column width,
         so there is nothing left for this to widen. */
      .pf-sub--wide { max-width: none; }

      /* ---- optionsvision.app ----
         getTradeVisionPageStyles() widens .container to 1000px and pads it for
         the old layout. That page is a .pf-page now, so those rules no longer
         reach it; these are the pieces it still needs. */
      .ov-page .tv-cta { margin: 14px 0 0; }
      /* The hero's 45px padding-bottom was the real gap under the App Store
         badge -- 45 plus the band's own top margin came to 63px of empty navy.
         Zeroed here so the single 22px band margin is the whole distance. */
      .ov-page .pf-hero { padding-bottom: 0; }
      .ov-page .tv-band { margin-top: 22px; }
      /* The two demo bands read as a pair, so they get the same title size, the
         same bottom padding and the same gap to the copy beneath. Measured
         first: the walkthrough was already the tighter of the two (10px padding
         and a 27px gap, against 29px and 34px), so they are equalised at its
         spacing rather than the videos band's. */
      .ov-page .tv-band { padding-bottom: 12px; }
      .ov-page .tv-copy { margin-top: 22px; }
      .ov-page .tv-copy .tv-walkthrough + h3 { margin-top: 22px; }
      .ov-page .tv-copy > p:first-child { margin-top: 0; }
      .ov-page .tv-disclaimer {
        margin-top: 26px;
        padding-top: 18px;
        border-top: 1px solid var(--border);
        font-size: 0.8125rem;
        color: var(--text-muted);
        max-width: none;
      }
      .ov-page .portfolio-embed { margin-top: 34px; }
      .pf-actions {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 24px;
        margin-top: 30px;
      }
      .pf-pill {
        display: inline-block;
        padding: 13px 26px;
        border-radius: 999px;
        background: var(--accent);
        color: var(--on-accent);
        text-decoration: none;
        font-size: 0.9375rem;
        transition: background 0.2s ease, transform 0.2s ease;
      }
      .pf-pill:hover {
        background: var(--accent-hover);
        transform: translateY(-1px);
        text-decoration: none;
      }
      .pf-quiet {
        color: var(--text-muted);
        font-size: 0.9375rem;
        text-decoration: underline;
        text-underline-offset: 4px;
        text-decoration-thickness: 1px;
      }
      .pf-quiet:hover { color: var(--text); }

      /* ---- Sections ----
         Child combinator, and the two component sections excluded by name.
         On the portfolio home the coverflow's <section class="tv-band"> is
         nested inside a work entry, so the combinator alone was enough. On
         optionsvision.app both it and <section class="tv-copy"> are direct
         children of .pf-page, so they were picking this up: at 0,1,1 it beat
         .tv-band's own 0,1,0 padding and gave the Demo Videos band a 29px lid
         and a second border across its top. Components bring their own frame. */
      .pf-page > section:not(.tv-band):not(.tv-copy) {
        border-top: 1px solid var(--border);
        padding: 29px 0;
        margin: 0;
      }
      .pf-page > section.pf-tight { padding: 21px 0 22px; }

      .pf-label {
        font-size: 1rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--gold);
        margin: 0 0 18px;
      }
      .pf-tight .pf-label { margin-bottom: 13px; }

      /* ---- Work ---- */
      .pf-entry { padding: 21px 0; border-bottom: 1px solid var(--border); }
      .pf-entry:first-of-type { padding-top: 0; }
      .pf-entry:last-of-type { border-bottom: 0; padding-bottom: 0; }
      .pf-kind {
        font-size: 0.6875rem;
        letter-spacing: 0.13em;
        text-transform: uppercase;
        color: var(--text-muted);
        margin: 0;
      }
      /* Child combinator, not a descendant one: the coverflow's own
         "Demo Videos" title is an h3 nested inside this entry, and a
         .pf-entry h3 rule (0,1,1) out-specifies .tv-band-title (0,1,0) --
         which silently repainted the band title from gold to off-white here
         while it stayed gold on the product site. */
      /* Both forms: the plain heading, and the one wrapped in .ov-lockup beside
         the brand mark. Still not a descendant selector -- the coverflow's own
         h3 sits deeper inside this entry and must keep its own styling. */
      .pf-entry > h3,
      .pf-entry > .ov-lockup > h3 {
        margin: 6px 0 0;
        font-size: clamp(1.5rem, 3.4vw, 1.9rem);
        line-height: 1.2;
        letter-spacing: -0.014em;
        font-weight: 400;
        color: var(--text);
      }
      .pf-entry > h3 a,
      .pf-entry > .ov-lockup > h3 a { color: inherit; text-decoration: none; }
      .pf-entry > h3 a:hover,
      .pf-entry > .ov-lockup > h3 a:hover { color: var(--accent); text-decoration: none; }
      .pf-desc {
        margin: 10px 0 0;
        color: var(--text-body);
        font-size: 1rem;
      }
      .pf-links {
        display: flex;
        flex-wrap: wrap;
        gap: 20px;
        margin-top: 14px;
      }
      .pf-links a { font-size: 0.875rem; }

      /* ---- Embedded PDFs and the YouTube demo ---- */
      .pf-embed { margin-top: 17px; }
      .pf-frame {
        position: relative;
        width: 100%;
        padding-top: 58%;
        border: 1px solid var(--border);
        border-radius: 8px;
        overflow: hidden;
        background: var(--surface);
      }
      .pf-frame.pf-video { padding-top: 56.25%; }
      .pf-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }

      /* ---- Experience: mono years against serif roles ---- */
      .pf-cv + .pf-cv {
        margin-top: 11px;
        padding-top: 11px;
        border-top: 1px solid var(--border);
      }
      .pf-cv h3 {
        margin: 0 0 4px;
        font-size: 0.9375rem;
        font-weight: 500;
        letter-spacing: 0.01em;
        color: var(--text-muted);
      }
      .pf-row {
        display: grid;
        grid-template-columns: 120px 1fr;
        gap: 0 24px;
        padding: 6px 0;
        border-bottom: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
      }
      .pf-row:last-child { border-bottom: 0; }
      .pf-year {
        font-size: 0.8125rem;
        color: var(--text-muted);
        font-variant-numeric: tabular-nums;
        padding-top: 4px;
        white-space: nowrap;
        margin: 0;
      }
      .pf-role { font-size: 1.0625rem; line-height: 1.45; color: var(--text); margin: 0; }
      .pf-org { display: block; font-size: 0.875rem; color: var(--text-muted); margin-top: 2px; }

      /* ---- Contact ---- */
      .pf-contact { padding: 2px 0; font-size: 1.0625rem; line-height: 1.45; margin: 0; }
      .pf-contact a { color: var(--text); text-decoration: underline; text-decoration-color: var(--border); text-underline-offset: 5px; }
      .pf-contact a:hover { color: var(--accent); text-decoration-color: var(--accent); }

      /* Same story as .pf-hero: the bare footer rule contributes an 80px top
         margin and centred text, both wrong for this layout. */
      .pf-foot {
        border-top: 1px solid var(--border);
        margin-top: 0;
        padding-top: 18px;
        font-size: 0.8125rem;
        color: var(--text-muted);
        text-align: left;
        display: flex;
        flex-wrap: wrap;
        gap: 6px 20px;
        justify-content: space-between;
      }
      .pf-foot p { margin: 0; color: inherit; }

      @media (max-width: 600px) {
        .pf-page { padding: 0 20px 44px; }
        .pf-row { grid-template-columns: 1fr; gap: 2px; }
        .pf-year { padding-top: 0; }
        .pf-foot { justify-content: flex-start; }
      }
    </style>
  `;
}

// ===== Shared Demo Videos coverflow (used by home + /tradevision) =====
function getCarouselCSS() {
  return `
      /* (3) Section banding: tinted panels break up the white */
      .tv-band {
        background: #f4f6f8;
        border: 1px solid #e6e9ec;
        border-radius: 16px;
        padding: 14px 24px 14px;
        margin: 6px 0 14px;
      }
      .tv-band-title {
        margin: 0 0 22px;
        color: #1a73e8;
        text-align: center;
      }

      /* (2) Demo Videos coverflow: active clip centered, neighbors behind + grayed */
      .tv-coverflow {
        position: relative;
        /* The two numbers the whole coverflow is built from: where a neighbour
           rests relative to centre, and half a neighbour's width once it is
           scaled down (365 * 0.8 / 2). The box below and the fan on the stage
           both derive from these, so they cannot drift apart again -- a fixed
           235px fan inside a 880px box is exactly how the cards ended up
           outside the band in the first place. */
        --tv-fan-max: 235px;
        --tv-card-half: 146px;
        /* Exactly as wide as a fully fanned row (762px), nothing more. Was
           880px, which was 118px wider than anything ever drawn: dead space on
           optionsvision.app, whose container is 1000px and where the 880 really
           did apply, and unreachable on the portfolio, whose 900px container
           caps this at 762 regardless. The cards are centred on the stage and
           the stage is centred in the band, so tightening the box does not
           move them -- it just stops the box claiming room it never uses. */
        max-width: calc(2 * (var(--tv-fan-max) + var(--tv-card-half)));
        margin: 0 auto;
      }
      .tv-cf-stage {
        position: relative;
        /* Derived, not fixed. The items are absolutely positioned, so the stage
           cannot size itself and has to be told a height -- but 702px was the
           full-width case frozen in. The card is 365px wide capped at 82vw, so
           below ~445px of viewport it shrinks while the stage did not: on a
           390px phone in portrait the card came out 571px tall inside a 702px
           stage, leaving 100px of empty navy above the dots. Landscape hid it
           because the card was back at full size.

           Same numbers as the card itself: min(365px, 82vw) wide, 177.78% tall
           (the 9:16 short-frame), plus its 2px border, plus 60px for the
           caption and its gap -- enough for the longest one to wrap to three
           lines at the narrowest width. At full width that is 711px against the
           old 702px, so desktop is unchanged to within a caption's leading. */
        height: calc(min(365px, 82vw) * 1.7778 + 62px);
        /* Hard guarantee that nothing escapes the band, at any width. This used
           to live only in the phone stylesheet, which left 601-905px unprotected.
           clip (not hidden) so the other axis stays visible and no scroll
           container is created. The margin is slack: at full width the outer
           cards now sit flush against this edge, and their scaled 1px border
           would otherwise be at the mercy of rounding. */
        overflow-x: clip;
        overflow-clip-margin: 2px;
        /* The stage is the reference for the fan-out below. */
        container-type: inline-size;
        /* How far the neighbours sit from centre. It has to track the stage,
           not be a constant: the cards are a fixed 365px, so a fixed push threw
           them clear out of the band on any stage narrower than the full 762px.
           50cqw is half the stage, so subtracting the neighbour's scaled
           half-width lands it flush against the inside edge of the box, capped
           at the resting offset once the stage can afford it -- which, now the
           box is the width of a fanned row, is exactly at full width. */
        --tv-fan: min(var(--tv-fan-max), max(0px, calc(50cqw - var(--tv-card-half))));
      }
      .tv-cf-item {
        position: absolute;
        top: 0;
        left: 50%;
        width: 365px;
        max-width: 82vw;
        margin: 0;
        transform: translateX(-50%) scale(0.8);
        opacity: 0;
        transition: transform 0.4s ease, opacity 0.4s ease, filter 0.4s ease;
        z-index: 1;
      }
      .tv-cf-item.is-active {
        transform: translateX(-50%) scale(1);
        opacity: 1;
        filter: none;
        z-index: 3;
      }
      .tv-cf-item.is-prev {
        transform: translateX(calc(-50% - var(--tv-fan))) scale(0.8);
        opacity: 0.6;
        filter: grayscale(0.9) brightness(0.75);
        z-index: 2;
        cursor: pointer;
      }
      .tv-cf-item.is-next {
        transform: translateX(calc(-50% + var(--tv-fan))) scale(0.8);
        opacity: 0.6;
        filter: grayscale(0.9) brightness(0.75);
        z-index: 2;
        cursor: pointer;
      }
      /* Neighbors: whole card is a click target to bring it forward (no play/scrub) */
      .tv-cf-item:not(.is-active) .tv-short-frame {
        pointer-events: none;
      }
      /* Shown at every width, matching the Demo Walkthrough. Clicking a
         neighbouring video still brings it forward too -- the arrows are a
         second way in, not a replacement for it. */
      .tv-coverflow .tv-carousel-arrow {
        z-index: 4;
      }
      .tv-cf-item .tv-carousel-caption {
        max-width: 365px;
        margin-left: auto;
        margin-right: auto;
      }
      @media (max-width: 600px) {
        /* Phones only. Here the 365px card is wider than the stage, so nothing
           can sit beside it and --tv-fan would floor at 0 and stack all three
           dead centre. Keep the original hard fan and let the stage clip it --
           the prev/next arrows are the way through at this width.
           Was max-width: 760px, which meant 601-760px got this off-screen fan
           without the clipping that only applies at 600px and below. */
        .tv-cf-item.is-prev { transform: translateX(calc(-50% - 42vw)) scale(0.78); }
        .tv-cf-item.is-next { transform: translateX(calc(-50% + 42vw)) scale(0.78); }
      }
      .tv-gallery {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 24px;
        margin: 30px 0 50px;
      }
      .tv-gallery figure {
        margin: 0;
        text-align: center;
      }
      .tv-gallery img {
        display: block;
        width: 100%;
        height: auto;
        border-radius: 12px;
        border: 1px solid #dadce0;
        background: #0d1117;
      }
      .tv-gallery figcaption {
        margin-top: 12px;
        font-size: 14px;
        color: #5f6368;
        line-height: 1.4;
      }
      .tv-copy h2 {
        margin-top: 45px;
        margin-bottom: 15px;
      }
      .tv-copy h3 {
        margin-top: 30px;
        margin-bottom: 8px;
        /* Was inheriting the 20px h3 default; bumped 2px. These are the accent
           headings -- cyan on optionsvision.app, blue here -- and the size is set
           on the shared rule so both sites stay in step. The gold walkthrough
           heading is unaffected: the .tv-walkthrough h3 rule is more specific.
           (No backticks in here: this whole stylesheet is a JS template literal.) */
        font-size: 22px;
        color: #1a73e8;
      }
      .tv-copy p {
        font-size: 17px;
      }
      .tv-copy ul {
        margin-bottom: 20px;
      }
      .tv-disclaimer {
        margin-top: 35px;
        font-size: 14px;
        color: #5f6368;
        border-top: 1px solid #dadce0;
        padding-top: 20px;
      }

      /* ===== Demo Videos carousel (YouTube Shorts, 9:16) ===== */
      .tv-carousel {
        position: relative;
        max-width: 460px;
        margin: 20px auto 50px;
      }
      .tv-carousel-viewport {
        overflow: hidden;
        max-width: 355px;
        margin: 0 auto;
        border-radius: 12px;
      }
      .tv-carousel-track {
        display: flex;
        transition: transform 0.35s ease;
      }
      .tv-carousel-slide {
        flex: 0 0 100%;
        min-width: 100%;
      }
      .tv-short-frame {
        position: relative;
        width: 100%;
        padding-top: 177.78%; /* 9:16 vertical */
        background: #0d1117;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid #dadce0;
      }
      .tv-short-frame video {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        border: 0;
        object-fit: contain;
        background: #000;
      }
      .tv-play-overlay {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 2;
        width: 76px;
        height: 76px;
        border-radius: 50%;
        border: none;
        padding: 0;
        background: rgba(233, 234, 237, 0.92); /* light gray */
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: opacity 0.25s ease, transform 0.2s ease, background 0.2s ease;
      }
      .tv-play-overlay svg {
        width: 36px;
        height: 36px;
        margin-left: 3px; /* optically center the triangle */
        fill: #202124; /* dark triangle for contrast on the light gray circle */
      }
      .tv-play-overlay:hover {
        background: rgba(255, 255, 255, 0.98);
        transform: translate(-50%, -50%) scale(1.06);
      }
      .tv-play-overlay.hidden {
        opacity: 0;
        pointer-events: none;
      }
      .tv-carousel-caption {
        text-align: center;
        font-size: 14px;
        color: #5f6368;
        line-height: 1.4;
        margin: 12px 0 0;
      }
      /* Image-carousel variant (app screenshots, no fixed 9:16 frame).
         Phones keep the original one-at-a-time slider. From 761px up the slides
         stack like the Demo Videos coverflow instead: the current one centre
         stage in full colour, its neighbours behind it scaled down and grayed,
         and clicking one brings it forward. */
      .tv-carousel--images .tv-carousel-viewport {
        max-width: 380px;
      }
      /* The narrow-screen slider is translated by the script rather than from
         here: the stacked layout above 760px must keep an untransformed track,
         or the whole stage slides sideways with it. */
      /* An arrow at either end of the run has nowhere to go -- the first slide
         has no left neighbour and the last has no right one. */
      .tv-carousel--images .tv-carousel-arrow.is-disabled {
        opacity: 0.3;
        pointer-events: none;
      }
      @media (max-width: 760px) {
        /* A little more room for the screenshots. The band's side padding is the
           binding constraint at this width, not the viewport's max-width. */
        .tv-walkthrough {
          padding-left: 10px;
          padding-right: 10px;
        }
      }
      @media (min-width: 761px) {
        .tv-carousel--images .tv-carousel-viewport {
          max-width: none;
          overflow: visible;
          border-radius: 0;
        }
        .tv-carousel--images .tv-carousel-track {
          position: relative;
          display: block;
          width: 300px;
          margin: 0 auto;
          /* Matches the 751x1560 slide exports, so the stage is exactly as tall
             as the active image without hardcoding a pixel height. */
          aspect-ratio: 751 / 1560;
          transform: none;
          transition: none;
        }
        .tv-carousel--images .tv-carousel-slide {
          position: absolute;
          top: 0;
          left: 50%;
          width: 100%;
          transform: translateX(-50%) scale(0.8);
          opacity: 0;
          /* Slides beyond the immediate neighbours are invisible; keep them from
             swallowing clicks aimed at what is on top of them. */
          pointer-events: none;
          transition: transform 0.4s ease, opacity 0.4s ease, filter 0.4s ease;
          z-index: 1;
        }
        .tv-carousel--images .tv-carousel-slide.is-active {
          transform: translateX(-50%) scale(1);
          opacity: 1;
          filter: none;
          z-index: 3;
        }
        .tv-carousel--images .tv-carousel-slide.is-prev,
        .tv-carousel--images .tv-carousel-slide.is-next {
          opacity: 0.6;
          filter: grayscale(0.9) brightness(0.75);
          z-index: 2;
          cursor: pointer;
          pointer-events: auto;
        }
        .tv-carousel--images .tv-carousel-slide.is-prev {
          transform: translateX(calc(-50% - 190px)) scale(0.8);
        }
        .tv-carousel--images .tv-carousel-slide.is-next {
          transform: translateX(calc(-50% + 190px)) scale(0.8);
        }
        .tv-carousel--images .tv-carousel-arrow { z-index: 4; }
      }
      .tv-carousel-img {
        display: block;
        width: 100%;
        height: auto;
        /* The slides are lazy-loaded; declaring the export ratio means a
           neighbour occupies its space before the bytes arrive. */
        aspect-ratio: 751 / 1560;
        border-radius: 12px;
      }
      /* --- Learning Library cards ---
         The cards carousel is wider than the phone-shaped image one, since a card
         is text rather than a screenshot. */
      .tv-carousel--cards .tv-carousel-viewport { max-width: 460px; }
      .tv-guide-card {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-height: 190px;
        padding: 22px;
        border: 1px solid var(--border);
        border-radius: 14px;
        background: var(--panel);
        text-decoration: none;
        transition: border-color 0.2s ease, transform 0.2s ease;
      }
      .tv-guide-card:hover {
        border-color: var(--accent);
        transform: translateY(-2px);
      }
      .tv-guide-card__kicker {
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-muted);
      }
      .tv-guide-card__title {
        font-size: 1.35rem;
        font-weight: 700;
        color: var(--text);
      }
      .tv-guide-card__dek {
        font-size: 0.95rem;
        line-height: 1.5;
        color: var(--text-body);
        flex: 1;
      }
      .tv-guide-card__more {
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--accent);
      }
      .tv-guides-intro {
        color: var(--text-muted);
        font-size: 0.95rem;
        margin-bottom: 6px;
      }
      /* --- Learning Library index --- */
      .tv-guide-list { display: flex; flex-direction: column; gap: 12px; margin: 24px 0 40px; }
      .tv-guide-row {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 18px 20px;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: var(--panel);
        text-decoration: none;
        transition: border-color 0.2s ease;
      }
      .tv-guide-row:hover { border-color: var(--accent); }
      .tv-guide-row__title { font-size: 1.15rem; font-weight: 700; color: var(--text); }
      .tv-guide-row__dek { font-size: 0.95rem; color: var(--text-body); }
      @media (max-width: 600px) {
        .tv-carousel--cards .tv-carousel-viewport { max-width: 300px; }
        .tv-guide-card { min-height: 0; padding: 18px; }
      }
      .tv-carousel-arrow {
        position: absolute;
        top: 40%;
        transform: translateY(-50%);
        z-index: 2;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: 1px solid #dadce0;
        background: #fff;
        color: #1a73e8;
        font-size: 26px;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
        transition: background 0.2s, box-shadow 0.2s;
      }
      .tv-carousel-arrow:hover {
        background: #f1f5fd;
        box-shadow: 0 3px 12px rgba(0, 0, 0, 0.18);
      }
      .tv-carousel-prev { left: 0; }
      .tv-carousel-next { right: 0; }
      .tv-carousel-dots {
        display: flex;
        justify-content: center;
        gap: 10px;
        margin-top: 8px;
      }
      .tv-carousel-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: none;
        background: #dadce0;
        cursor: pointer;
        padding: 0;
        transition: background 0.2s, transform 0.2s;
      }
      .tv-carousel-dot.active {
        background: #1a73e8;
        transform: scale(1.25);
      }
      @media (max-width: 640px) {
        .tv-gallery {
          grid-template-columns: 1fr;
          max-width: 340px;
          margin-left: auto;
          margin-right: auto;
        }
      }
      @media (max-width: 480px) {
        .tv-carousel { max-width: 340px; }
        .tv-carousel-arrow { background: rgba(255, 255, 255, 0.85); }
        .tv-carousel-prev { left: 2px; }
        .tv-carousel-next { right: 2px; }
      }`;
}

function getWalkthroughCarouselHTML() {
  // The seven intro slides -- the same images the app ships in
  // Assets.xcassets/WalkthroughN.imageset and shows on first launch and from the
  // Walkthrough Library's "Intro Walkthrough" row. Regenerate all three copies
  // together from Walkthrough_Slides_Clean.pdf so the app and both sites never drift.
  // Served from public/tradevision/walkthrough/ at 751x1560 (2x the 360px carousel viewport).
  return `      <!-- Demo Walkthrough: seven intro slides, shared by optionsvision.app and the portfolio case study. -->
      <div class="portfolio-embed tv-walkthrough">
        <h3>Demo Walkthrough</h3>
        <div class="tv-carousel tv-carousel--images" id="walkthroughCarousel">
          <button class="tv-carousel-arrow tv-carousel-prev" type="button" aria-label="Previous slide">&#8249;</button>
          <div class="tv-carousel-viewport">
            <div class="tv-carousel-track">
              <div class="tv-carousel-slide">
                <img class="tv-carousel-img" src="/tradevision/walkthrough/1.png" alt="OptionsVision walkthrough slide 1" loading="lazy" />
              </div>
              <div class="tv-carousel-slide">
                <img class="tv-carousel-img" src="/tradevision/walkthrough/2.png" alt="OptionsVision walkthrough slide 2" loading="lazy" />
              </div>
              <div class="tv-carousel-slide">
                <img class="tv-carousel-img" src="/tradevision/walkthrough/3.png" alt="OptionsVision walkthrough slide 3" loading="lazy" />
              </div>
              <div class="tv-carousel-slide">
                <img class="tv-carousel-img" src="/tradevision/walkthrough/4.png" alt="OptionsVision walkthrough slide 4" loading="lazy" />
              </div>
              <div class="tv-carousel-slide">
                <img class="tv-carousel-img" src="/tradevision/walkthrough/5.png" alt="OptionsVision walkthrough slide 5" loading="lazy" />
              </div>
              <div class="tv-carousel-slide">
                <img class="tv-carousel-img" src="/tradevision/walkthrough/6.png" alt="OptionsVision walkthrough slide 6" loading="lazy" />
              </div>
              <div class="tv-carousel-slide">
                <img class="tv-carousel-img" src="/tradevision/walkthrough/7.png" alt="OptionsVision walkthrough slide 7" loading="lazy" />
              </div>
            </div>
          </div>
          <button class="tv-carousel-arrow tv-carousel-next" type="button" aria-label="Next slide">&#8250;</button>
          <div class="tv-carousel-dots">
            <button class="tv-carousel-dot" type="button" aria-label="Go to slide 1"></button>
            <button class="tv-carousel-dot" type="button" aria-label="Go to slide 2"></button>
            <button class="tv-carousel-dot" type="button" aria-label="Go to slide 3"></button>
            <button class="tv-carousel-dot" type="button" aria-label="Go to slide 4"></button>
            <button class="tv-carousel-dot" type="button" aria-label="Go to slide 5"></button>
            <button class="tv-carousel-dot" type="button" aria-label="Go to slide 6"></button>
            <button class="tv-carousel-dot" type="button" aria-label="Go to slide 7"></button>
          </div>
        </div>
      </div>
`;
}

function getDemoVideosHTML() {
  return `      <!-- Demo Videos: three R2-hosted MP4s (videos.vishnumuthiah.com/v2/) in a coverflow. -->
      <!-- One active/centered; neighbors sit behind, scaled + grayed. Click a neighbor to bring it forward. -->
      <section class="tv-band">
        <h3 class="tv-band-title">Demo Videos</h3>
        <div class="tv-coverflow" id="demoCoverflow">
          <!-- Arrows are hidden on desktop (tap a neighbor video to switch) and shown
               only on phones, where the neighbor videos are clipped off-screen. -->
          <button class="tv-carousel-arrow tv-carousel-prev" type="button" aria-label="Previous video">&#8249;</button>
          <div class="tv-cf-stage">

            <figure class="tv-cf-item is-prev">
              <div class="tv-short-frame">
                <video class="tv-video" controls playsinline preload="metadata" src="https://videos.vishnumuthiah.com/v2/Call%20Debit%20Spread%20-%20TradeVision%20Edge%20Demo.mp4#t=0.001"></video>
                <button class="tv-play-overlay" type="button" aria-label="Play video"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></button>
              </div>
              <figcaption class="tv-carousel-caption">Call Debit Spread — bullish balanced 2-leg vertical spread</figcaption>
            </figure>

            <figure class="tv-cf-item is-active">
              <div class="tv-short-frame">
                <video class="tv-video" controls playsinline preload="metadata" src="https://videos.vishnumuthiah.com/v2/Long%20Call%20-%20TradeVision%20Edge%20Demo.mp4#t=0.001"></video>
                <button class="tv-play-overlay" type="button" aria-label="Play video"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></button>
              </div>
              <figcaption class="tv-carousel-caption">Long Call — bullish single leg</figcaption>
            </figure>

            <figure class="tv-cf-item is-next">
              <div class="tv-short-frame">
                <video class="tv-video" controls playsinline preload="metadata" src="https://videos.vishnumuthiah.com/v2/Long%20Iron%20Condor%20-%20TradeVision%20Edge.MP4#t=0.001"></video>
                <button class="tv-play-overlay" type="button" aria-label="Play video"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></button>
              </div>
              <figcaption class="tv-carousel-caption">Long Iron Condor — breakout balanced 4-leg</figcaption>
            </figure>

          </div>
          <button class="tv-carousel-arrow tv-carousel-next" type="button" aria-label="Next video">&#8250;</button>
          <div class="tv-carousel-dots">
            <button class="tv-carousel-dot" type="button" aria-label="Show Call Debit Spread"></button>
            <button class="tv-carousel-dot active" type="button" aria-label="Show Long Call"></button>
            <button class="tv-carousel-dot" type="button" aria-label="Show Long Iron Condor"></button>
          </div>
        </div>
      </section>`;
}

function getDemoVideosScript() {
  return `    <script>
      (function () {
        function initCarousel(carousel) {
          var track = carousel.querySelector('.tv-carousel-track');
          var slides = carousel.querySelectorAll('.tv-carousel-slide');
          var dots = carousel.querySelectorAll('.tv-carousel-dot');
          var prev = carousel.querySelector('.tv-carousel-prev');
          var next = carousel.querySelector('.tv-carousel-next');
          if (!track || !slides.length) return;
          var count = slides.length;
          var index = 0;
          // The image carousel has two layouts. Narrow screens keep the original
          // slider -- one screenshot at a time, translated into view. Wider ones
          // stack the slides coverflow-style, placed by class, where the track
          // must stay untransformed or the whole stage travels with it.
          var stacked = carousel.classList.contains('tv-carousel--images');
          var narrow = window.matchMedia('(max-width: 760px)');
          function placeTrack() {
            track.style.transform = narrow.matches
              ? 'translateX(-' + (index * 100) + '%)'
              : '';
          }
          if (stacked) {
            var onBreakpoint = function () { placeTrack(); };
            if (narrow.addEventListener) narrow.addEventListener('change', onBreakpoint);
            else if (narrow.addListener) narrow.addListener(onBreakpoint);
          }

          function pauseAll() {
            carousel.querySelectorAll('video').forEach(function (v) {
              try { v.pause(); } catch (e) {}
            });
          }

          function go(i) {
            pauseAll();
            if (stacked) {
              // The run does not wrap: the first slide has no left neighbour and
              // the last has no right one, so stepping stops at either end.
              index = Math.max(0, Math.min(count - 1, i));
              slides.forEach(function (s, si) {
                s.classList.remove('is-active', 'is-prev', 'is-next');
                if (si === index) s.classList.add('is-active');
                else if (si === index - 1) s.classList.add('is-prev');
                else if (si === index + 1) s.classList.add('is-next');
              });
              if (prev) prev.classList.toggle('is-disabled', index === 0);
              if (next) next.classList.toggle('is-disabled', index === count - 1);
              placeTrack();
            } else {
              index = (i + count) % count;
              track.style.transform = 'translateX(-' + (index * 100) + '%)';
            }
            dots.forEach(function (d, di) { d.classList.toggle('active', di === index); });
          }

          if (prev) prev.addEventListener('click', function () { go(index - 1); });
          if (next) next.addEventListener('click', function () { go(index + 1); });
          dots.forEach(function (d, di) {
            d.addEventListener('click', function () { go(di); });
          });
          // A grayed neighbour is a click target that brings it forward.
          if (stacked) {
            slides.forEach(function (s, si) {
              s.addEventListener('click', function (e) {
                if (si !== index) { e.preventDefault(); go(si); }
              });
            });
          }

          go(0);
        }

        document.querySelectorAll('.tv-carousel').forEach(initCarousel);

        // Demo Videos coverflow: one active/centered, neighbors behind + grayed.
        (function initCoverflow() {
          var cf = document.getElementById('demoCoverflow');
          if (!cf) return;
          var items = Array.prototype.slice.call(cf.querySelectorAll('.tv-cf-item'));
          var dots = cf.querySelectorAll('.tv-carousel-dot');
          var prevBtn = cf.querySelector('.tv-carousel-prev');
          var nextBtn = cf.querySelector('.tv-carousel-next');
          var n = items.length;
          if (!n) return;
          var current = 0;
          items.forEach(function (it, i) { if (it.classList.contains('is-active')) current = i; });

          function render() {
            items.forEach(function (it, i) {
              var rel = (i - current + n) % n;
              it.classList.remove('is-active', 'is-prev', 'is-next');
              if (rel === 0) it.classList.add('is-active');
              else if (rel === 1) it.classList.add('is-next');
              else if (rel === n - 1) it.classList.add('is-prev');
            });
            dots.forEach(function (d, i) { d.classList.toggle('active', i === current); });
          }

          function go(i) {
            cf.querySelectorAll('video').forEach(function (v) { try { v.pause(); } catch (e) {} });
            current = (i + n) % n;
            render();
          }

          items.forEach(function (it, i) {
            it.addEventListener('click', function (e) {
              if (i !== current) { e.preventDefault(); go(i); }
            });
          });
          if (prevBtn) prevBtn.addEventListener('click', function () { go(current - 1); });
          if (nextBtn) nextBtn.addEventListener('click', function () { go(current + 1); });
          dots.forEach(function (d, i) { d.addEventListener('click', function () { go(i); }); });

          render();
        })();

        // Play button per demo video: click to play, hide while playing,
        // reappear on pause/end.
        // Touch devices synthesize a "ghost" click ~300ms after a tap. When a tap
        // pauses the video, the overlay reappears and that delayed ghost click can
        // land on it and immediately replay the video. Guard against activations
        // that happen right after the overlay is shown — touch only, so mouse/PC
        // behavior is unchanged.
        var isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
        document.querySelectorAll('.tv-short-frame').forEach(function (frame) {
          var v = frame.querySelector('video');
          var ov = frame.querySelector('.tv-play-overlay');
          if (!v || !ov) return;
          var shownAt = 0;
          function showOverlay() { ov.classList.remove('hidden'); shownAt = Date.now(); }
          ov.addEventListener('click', function (e) {
            if (isTouch && Date.now() - shownAt < 450) { e.preventDefault(); return; }
            v.play();
          });
          v.addEventListener('play', function () { ov.classList.add('hidden'); });
          v.addEventListener('pause', showOverlay);
          v.addEventListener('ended', showOverlay);
        });
      })();
    </script>`;
}

// ===== OPTIONSVISION LEGAL PAGES (optionsvision.app) =====
// One renderer for all three generated documents. These are what App Store
// Connect's privacy-policy URL should point at -- the portfolio's /privacy-policy
// and /terms-of-service cover the Sources Tracker add-on and are unrelated.

function escapeHTML(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// path -> generated document key
const APP_LEGAL_ROUTES = {
  '/privacy-policy': 'privacy',
  '/terms-of-service': 'terms',
  '/disclaimer': 'disclaimer',
};

function getAppLegalHTML(key) {
  const doc = LEGAL_DOCS.find((d) => d.key === key);
  const others = LEGAL_DOCS.filter((d) => d.key !== key);
  const pathFor = (k) => Object.keys(APP_LEGAL_ROUTES).find((p) => APP_LEGAL_ROUTES[p] === k);

  const sections = doc.sections.map((s) => `
        ${s.heading ? `<h2>${escapeHTML(s.heading)}</h2>` : ''}
        <p>${escapeHTML(s.body)}</p>`).join('\n');

  return getLayout(`${doc.title} — ${LEGAL_INFO.appName}`, `
    <div class="container">
      <a href="/" class="back-link">← Back to ${LEGAL_INFO.appName}</a>

      <h1>${escapeHTML(doc.title)}</h1>
      <p class="tagline">${escapeHTML(doc.summary)}</p>
      <p class="updated">Effective ${escapeHTML(LEGAL_INFO.effectiveDate)}</p>

      <section class="tv-copy">
${sections}

        <p class="tv-disclaimer">${escapeHTML(LEGAL_FINE_PRINT)}</p>
      </section>

      <footer>
        <p>&copy; 2026 ${escapeHTML(LEGAL_INFO.provider)}. All rights reserved.</p>
        <p style="margin-top: 10px;">
          <a href="/">Home</a> |
          <a href="/support">Application Support</a> |
          ${others.map((d) => `<a href="${pathFor(d.key)}">${escapeHTML(d.title)}</a>`).join(' |\n          ')}
        </p>
      </footer>
    </div>
  `, getLegalPageStyles(), {
    description: escapeHTML(doc.summary),
    url: `https://${APP_HOST}${pathFor(key)}`,
  });
}

// ===== OPTIONSVISION SUPPORT (optionsvision.app/support) =====
function getAppSupportHTML() {
  return getLayout(`Support — ${LEGAL_INFO.appName}`, `
    <div class="container">
      <a href="/" class="back-link">← Back to ${LEGAL_INFO.appName}</a>

      <h1>Support</h1>
      <p class="tagline">Questions, bugs, and feature requests for ${LEGAL_INFO.appName}.</p>

      <section class="tv-copy">
        <div class="contact-info">
          <ul>
            <li><strong>Email:</strong> <a href="mailto:${LEGAL_INFO.contactEmail}">${LEGAL_INFO.contactEmail}</a></li>
            <li><strong>Response time:</strong> 48–72 hours</li>
          </ul>
        </div>

        <h2>Reporting a bug</h2>
        <p>Email the address above with as much of this as you have — it makes a problem far quicker to pin down:</p>
        <ul>
          <li>What you expected to happen, and what happened instead</li>
          <li>The steps that produce it</li>
          <li>The strategy involved (for example, a call debit spread or a calendar)</li>
          <li>Your app version and iOS version, both listed under Settings in the app</li>
          <li>A screenshot, if the problem is something you can see</li>
        </ul>
        <p>Please don't send account numbers, brokerage credentials, or anything else sensitive — none of it is needed to diagnose an issue.</p>

        <h2>Feature requests</h2>
        <p>Put <strong>Feature Request</strong> in the subject line and describe what you're trying to do and where the app gets in the way. Requests framed around the decision you're trying to make are the most useful ones.</p>

        <h2>Why don't my Greeks match my broker?</h2>
        <p>${LEGAL_INFO.appName} solves each leg's implied volatility from the entry price you gave it, so the Greeks describe the position as you actually opened it. Your broker computes its Greeks from the option's current market price instead. Both are correct; they answer slightly different questions, and the two will diverge as the market moves away from your entry.</p>

        <h2>Does the app see my brokerage account?</h2>
        <p>No. ${LEGAL_INFO.appName} never connects to a brokerage, cannot place or modify orders, and has no account to sign into. Screenshots you import are read on your device and are not uploaded. See the <a href="/privacy-policy">Privacy Policy</a> for the detail.</p>

        <p class="tv-disclaimer">${escapeHTML(LEGAL_FINE_PRINT)}</p>
      </section>

      <footer>
        <p>&copy; 2026 ${escapeHTML(LEGAL_INFO.provider)}. All rights reserved.</p>
        <p style="margin-top: 10px;">
          <a href="/">Home</a> |
          <a href="/privacy-policy">Privacy Policy</a> |
          <a href="/terms-of-service">Terms of Use</a> |
          <a href="/disclaimer">Financial Disclaimer</a>
        </p>
      </footer>
    </div>
  `, getLegalPageStyles(), {
    description: `Support for ${LEGAL_INFO.appName} — how to report a bug, request a feature, or get in touch.`,
    url: `https://${APP_HOST}/support`,
  });
}

// ===== Learning Library =====
// Five strategy guides, each its own page at /resources/<slug> on optionsvision.app,
// surfaced by a card carousel at the bottom of the product page.
//
// Content is written per-guide in its own session, edited by hand, and given real
// screenshots and citations before it goes anywhere. So each entry carries a
// `published` flag and this file treats it strictly:
//   published: false -> the page renders a draft notice and is marked noindex, and
//                       the guide is left OUT of the carousel entirely.
//   published: true  -> normal page, indexable, appears in the carousel.
// The carousel renders nothing at all while every guide is a draft, so the live
// site is unchanged until there is something worth reading. Half-finished
// financial explainers must never be publicly linked or indexed under this domain.
//
// To publish one: fill `dek` and `body`, flip `published`, deploy.
// `body` is a list of { h, p } -- a heading and its paragraphs.
const GUIDES = [
  {
    slug: 'long-call',
    title: 'Long Calls',
    dek: '',
    published: false,
    body: [],
  },
  {
    slug: 'covered-call',
    title: 'Covered Calls',
    dek: '',
    published: false,
    body: [],
  },
  {
    slug: 'cash-secured-put',
    title: 'Cash-Secured Puts',
    dek: '',
    published: false,
    body: [],
  },
  {
    slug: 'vertical-spreads',
    title: 'Vertical Spreads',
    dek: '',
    published: false,
    body: [],
  },
  {
    slug: 'iron-condors',
    title: 'Iron Condors',
    dek: '',
    published: false,
    body: [],
  },
];

const publishedGuides = () => GUIDES.filter((g) => g.published && g.body.length);

/// Card carousel for the bottom of the product page. Reuses initCarousel, which
/// wires any .tv-carousel generically. Returns nothing while no guide is published,
/// so the section simply does not exist yet.
function getGuidesCarouselHTML() {
  const live = publishedGuides();
  if (!live.length) return '';
  // Product host only, so these are same-origin paths. The absolute-URL variant
  // existed for the portfolio mirror at /optionsvision, retired 2026-07-26.
  const base = '/resources/';
  const slides = live.map((g) => `
              <div class="tv-carousel-slide">
                <a class="tv-guide-card" href="${base}${g.slug}">
                  <span class="tv-guide-card__kicker">Strategy guide</span>
                  <span class="tv-guide-card__title">${escapeHTML(g.title)}</span>
                  <span class="tv-guide-card__dek">${escapeHTML(g.dek)}</span>
                  <span class="tv-guide-card__more">Read the guide &rarr;</span>
                </a>
              </div>`).join('');
  const dots = live.map((g, i) =>
    `            <button class="tv-carousel-dot" type="button" aria-label="Go to guide ${i + 1}"></button>`).join('\n');
  return `      <div class="portfolio-embed tv-walkthrough">
        <h3>Learning Library</h3>
        <p class="tv-guides-intro">Plain-English guides to the strategies OptionsVision charts.</p>
        <div class="tv-carousel tv-carousel--cards" id="guidesCarousel">
          <button class="tv-carousel-arrow tv-carousel-prev" type="button" aria-label="Previous guide">&#8249;</button>
          <div class="tv-carousel-viewport">
            <div class="tv-carousel-track">${slides}
            </div>
          </div>
          <button class="tv-carousel-arrow tv-carousel-next" type="button" aria-label="Next guide">&#8250;</button>
          <div class="tv-carousel-dots">
${dots}
          </div>
        </div>
      </div>`;
}

/// The /resources index. Lists published guides; says so plainly when there are none.
function getLearningLibraryHTML() {
  const live = publishedGuides();
  const list = live.length
    ? live.map((g) => `        <a class="tv-guide-row" href="/resources/${g.slug}">
          <span class="tv-guide-row__title">${escapeHTML(g.title)}</span>
          <span class="tv-guide-row__dek">${escapeHTML(g.dek)}</span>
        </a>`).join('\n')
    : `        <p class="tv-guides-intro">The first guides are being written. Check back shortly.</p>`;

  return getLayout('Resources — OptionsVision', `
${getStickyBarHTML('Get the App', 'https://apps.apple.com/app/id6786063635', OV_NAV_LINKS)}
    ${getOvNavHTML()}
    <div class="container">
      <h1>Resources</h1>
      <p class="tagline">Selection of OptionsVision guides to learn about options.</p>
      <div class="tv-guide-list">
${list}
      </div>
    </div>
  `, getTradeVisionPageStyles(), {
    description: 'Selection of OptionsVision guides to learn about options.',
    url: 'https://' + APP_HOST + '/resources',
    noindex: live.length === 0,
  });
}

/// One guide page. An unpublished guide renders an honest placeholder rather than
/// a half-written explainer, and is never indexed.
function getGuideHTML(guide) {
  const draft = !guide.published || !guide.body.length;
  const body = draft
    ? `      <section class="tv-copy">
        <h2>Not published yet</h2>
        <p>This guide is still being written. In the meantime, the app itself is the fastest way to see how this strategy behaves &mdash; import a trade and move the days-to-expiration and volatility sliders.</p>
      </section>`
    : `      <section class="tv-copy">
${guide.body.map((s) => `        <h2>${escapeHTML(s.h)}</h2>
${s.p.map((p) => `        <p>${escapeHTML(p)}</p>`).join('\n')}`).join('\n')}
      </section>`;

  return getLayout(escapeHTML(guide.title) + ' — OptionsVision', `
${getStickyBarHTML('Get the App', 'https://apps.apple.com/app/id6786063635')}
    <div class="container">
      <a href="/resources" class="back-link">&larr; Resources</a>
      <h1>${escapeHTML(guide.title)}</h1>
      ${guide.dek ? `<p class="tagline">${escapeHTML(guide.dek)}</p>` : ''}
${body}
      <p class="tv-disclaimer">${escapeHTML(LEGAL_FINE_PRINT)}</p>
    </div>
  `, getTradeVisionPageStyles(), {
    description: guide.dek || (guide.title + ' — a plain-English strategy guide from OptionsVision.'),
    url: 'https://' + APP_HOST + '/resources/' + guide.slug,
    noindex: draft,
  });
}

/// The 32 supported strategies, as eight groups. Was a bulleted list whose
/// items ran to six comma-separated strategies each -- readable, but a wall.
///
/// The counts here are the source of truth for the "32 strategies" claim made
/// in the hero, the copy above the grid and the App Store listing:
/// 4 + 4 + 2 + 3 + 4 + 6 + 6 + 3 = 32. Adding a strategy means editing this
/// array and the three places that quote the total.
/// `suffix` is the part of each strategy's full name that the group heading
/// already says. It is NOT dropped -- it is rendered in a visually hidden span,
/// so the chip reads "Long call" under a card titled Condors while the DOM, a
/// screen reader and a crawler all still get "Long call condor".
///
/// It exists for two reasons. A panel is only as wide as its card -- about
/// 235px of interior at the four-column layout, so ~110px a column -- and "Long
/// call butterfly" does not fit in that without wrapping every single row. And
/// a card that says Butterflies at the top does not need to say butterfly six
/// more times underneath.
const OV_STRATEGY_GROUPS = [
  { name: 'Single Leg', suffix: '', items: ['Long call', 'Long put', 'Covered call', 'Cash-secured put'] },
  { name: 'Vertical Spreads', suffix: ' spread', items: ['Call debit', 'Call credit', 'Put debit', 'Put credit'] },
  { name: 'Straddles &amp; Strangles', suffix: '', items: ['Long straddle', 'Long strangle'] },
  { name: 'Calendar Spreads', suffix: ' calendar spread', items: ['Long call', 'Long put', 'Short put'] },
  { name: 'Diagonals', suffix: ' diagonal', items: ['Long call', 'Long put', 'Short put', 'Short call (covered)'] },
  { name: 'Condors', suffix: ' condor', items: ['Long call', 'Short call', 'Long put', 'Short put', 'Long iron', 'Short iron'] },
  { name: 'Butterflies', suffix: ' butterfly', items: ['Long call', 'Short call', 'Long put', 'Short put', 'Long iron', 'Short iron'] },
  { name: 'Unbalanced Ratios', suffix: ' ratio', items: ['Put front', 'Call back', 'Put back'] },
];

/// Eight cards; the members appear on hover, in a panel that overlays whatever
/// is beneath it rather than pushing it down.
///
/// Every strategy name is in the DOM at all times and hidden with CSS, never
/// injected on open: the list stays selectable, findable with the browser's own
/// find-in-page, and readable with JS off.
///
/// Hover cannot be the only way in -- a touch screen has no hover, and this is
/// an iPhone app's landing page, so most visitors are on one. The button below
/// gives touch and keyboard the same reveal, and the CSS gates the hover rule
/// behind `(hover: hover)` so a tap does not leave a panel stuck open.
function getStrategyGridHTML() {
  const cards = OV_STRATEGY_GROUPS.map((group, i) => {
    const panelId = 'ovStrat' + i;
    // "Short call (covered)" keeps its qualifier on the visible chip but must
    // not read as "Short call (covered) diagonal" -- the suffix goes before the
    // parenthetical in the hidden half so the full name stays grammatical.
    const items = group.items.map((s) => {
      if (!group.suffix) return '<li class="ov-strat__item">' + s + '</li>';
      const paren = s.indexOf(' (');
      const stem = paren === -1 ? s : s.slice(0, paren);
      const tail = paren === -1 ? '' : s.slice(paren);
      return '<li class="ov-strat__item">' + stem +
             '<span class="ov-vh">' + group.suffix + '</span>' + tail + '</li>';
    }).join('');
    return `        <div class="ov-strat__card">
          <button class="ov-strat__head" type="button" aria-expanded="false" aria-controls="${panelId}">
            <span class="ov-strat__name">${group.name}</span>
            <span class="ov-strat__count">${group.items.length}</span>
          </button>
          <div class="ov-strat__panel" id="${panelId}">
            <ul>${items}</ul>
          </div>
        </div>`;
  }).join('\n');

  return `<div class="ov-strat">
${cards}
      </div>
      <script>
        (function () {
          var grid = document.querySelector('.ov-strat');
          if (!grid) return;
          function closeAll(except) {
            grid.querySelectorAll('.ov-strat__card.is-open').forEach(function (c) {
              if (c === except) return;
              c.classList.remove('is-open');
              var b = c.querySelector('.ov-strat__head');
              if (b) b.setAttribute('aria-expanded', 'false');
            });
          }
          grid.addEventListener('click', function (e) {
            var head = e.target.closest('.ov-strat__head');
            if (!head) return;
            var card = head.parentElement;
            var open = card.classList.toggle('is-open');
            head.setAttribute('aria-expanded', open ? 'true' : 'false');
            closeAll(card);
          });
          // A tap anywhere else dismisses. Without this a touch visitor who
          // opened a card would have to find it again to close it.
          document.addEventListener('click', function (e) {
            if (!e.target.closest('.ov-strat')) closeAll(null);
          });
          document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeAll(null);
          });
        })();
      </script>`;
}

/// The at-rest nav, shared by every page on the product host. Extracted when
/// /model and /model/import arrived: three copies of a nav is three places for
/// a link to go stale.
function getOvNavHTML() {
  return `<nav class="ov-nav" aria-label="Primary">
      <a class="ov-nav__brand" href="/">
        <span class="ov-nav__wordmark pf-serif">OptionsVision</span>
        ${OV_TREND_MARK_SVG}
      </a>
      <div class="ov-nav__links">
        ${OV_NAV_LINKS}
      </div>
      <a class="ov-nav__cta" href="https://apps.apple.com/app/id6786063635" target="_blank" rel="noopener noreferrer">Get the App</a>
    </nav>`;
}

/// The 32 strategy names EXACTLY as the app spells them (TradeKind.rawValue and
/// AdvancedStrategy.rawValue). Taken from the share page's SENTIMENTS table
/// rather than retyped: that table keys the sentiment chip off these strings, so
/// a name that differs by even a capital letter renders as "Neutral" whatever
/// the trade actually is. The mixed casing is the app's, not a typo.
const OV_STRATEGY_NAMES = [
  'Long Call', 'Long Put', 'Covered Call', 'Cash-Secured Put',
  'Call Debit Spread', 'Call Credit Spread', 'Put Debit Spread', 'Put Credit Spread',
  'Long Straddle', 'Long Strangle',
  'Long Call Calendar', 'Long Put Calendar', 'Short Put Calendar',
  'Long Call Diagonal', 'Long Put Diagonal', 'Short Put Diagonal', 'Short Call Diagonal (Covered)',
  'Long call condor', 'Short call condor', 'Long put condor', 'Short put condor',
  'Long iron condor', 'Short iron condor',
  'Long call butterfly', 'Short call butterfly', 'Long put butterfly', 'Short put butterfly',
  'Long iron butterfly', 'Short iron butterfly',
  'Put front ratio', 'Call back ratio', 'Put back ratio',
];

/// The manual-input page.
///
/// It deliberately contains NO options math. The /p/ share page is already a
/// verified port of the app's Black-Scholes -- scripts/check-share-web-parity.mjs
/// diffs it against the app across all 32 strategies -- so this page's whole job
/// is to build the payload that page already reads and hand off to it. A second
/// copy of the pricing engine on the web would be a copy with no parity test
/// behind it, free to drift silently while both pages still render a chart.
///
/// The payoff of that choice: every position modelled here comes out at a real
/// /p/ URL, so it is shareable by construction.
///
/// Leg shape, matching legsFromPayload: t 0=call 1=put 2=share, s +1 long /
/// -1 short, k strike, q quantity, e entry premium per share, d days this leg
/// expires AFTER the front expiration (0 for everything single-expiration; a
/// calendar's back leg is positive).
function getModelHTML() {
  const options = OV_STRATEGY_NAMES.map((n) => `<option value="${n}">${n}</option>`).join('\n            ');
  return getLayout('Model an Options Position — OptionsVision', `
${getStickyBarHTML('Get the App', 'https://apps.apple.com/app/id6786063635', OV_NAV_LINKS)}
    ${getOvNavHTML()}
    <div class="pf-page ov-page ov-model">
      <header class="ov-model__head">
        <h1 class="ov-model__title pf-serif">Model a position</h1>
        <p class="ov-model__sub">Enter a trade leg by leg and chart its profit and loss before expiration. Nothing is sent anywhere &mdash; the position is encoded into the link itself.</p>
      </header>

      <form class="ov-model__form" id="ovModelForm" novalidate>
        <div class="ov-field-row">
          <label class="ov-field">
            <span>Symbol <em>optional</em></span>
            <input type="text" id="mSymbol" placeholder="AAPL" autocomplete="off" maxlength="8">
          </label>
          <label class="ov-field">
            <span>Spot price</span>
            <input type="number" id="mSpot" step="0.01" min="0.01" placeholder="312.66" inputmode="decimal" required>
          </label>
          <label class="ov-field">
            <span>Front expiration</span>
            <input type="date" id="mExp" required>
          </label>
        </div>

        <label class="ov-field">
          <span>Strategy <em>names the chart; the legs below do the pricing</em></span>
          <select id="mKind">
            ${options}
          </select>
        </label>

        <div class="ov-legs" id="mLegs"></div>

        <div class="ov-model__actions">
          <button type="button" class="ov-btn-ghost" id="mAddLeg">Add a leg</button>
          <button type="submit" class="ov-btn-primary" id="mGo">Chart this position</button>
        </div>

        <details class="ov-adv">
          <summary>Rate and dividend assumptions</summary>
          <div class="ov-field-row">
            <label class="ov-field">
              <span>Risk-free rate <em>%</em></span>
              <input type="number" id="mRate" step="0.01" value="4.25" inputmode="decimal">
            </label>
            <label class="ov-field">
              <span>Dividend yield <em>%</em></span>
              <input type="number" id="mDiv" step="0.01" value="0" inputmode="decimal">
            </label>
          </div>
        </details>

        <p class="ov-model__err" id="mErr" role="alert" hidden></p>
      </form>

      <p class="tv-disclaimer">OptionsVision is an educational tool and is not investment advice, not a broker, and never touches your brokerage account. Figures are theoretical model estimates, not live quotes. Options involve substantial risk and are not suitable for every investor.</p>
    </div>

    <script>
    (function () {
      var legsEl = document.getElementById('mLegs');
      var form = document.getElementById('mForm') || document.getElementById('ovModelForm');
      var errEl = document.getElementById('mErr');
      var n = 0;

      function legRow() {
        var i = ++n;
        var d = document.createElement('div');
        d.className = 'ov-leg';
        d.innerHTML =
          '<div class="ov-leg__head"><span class="ov-leg__n">Leg ' + i + '</span>' +
          '<button type="button" class="ov-leg__rm" aria-label="Remove this leg">Remove</button></div>' +
          '<div class="ov-field-row">' +
            '<label class="ov-field"><span>Type</span><select data-f="t">' +
              '<option value="0">Call</option><option value="1">Put</option><option value="2">Shares</option>' +
            '</select></label>' +
            '<label class="ov-field"><span>Side</span><select data-f="s">' +
              '<option value="1">Long</option><option value="-1">Short</option>' +
            '</select></label>' +
            '<label class="ov-field"><span>Strike</span>' +
              '<input type="number" step="0.01" min="0.01" data-f="k" inputmode="decimal"></label>' +
            '<label class="ov-field"><span>Entry premium <em>per share</em></span>' +
              '<input type="number" step="0.01" min="0" data-f="e" inputmode="decimal"></label>' +
            '<label class="ov-field"><span>Contracts</span>' +
              '<input type="number" step="1" min="1" value="1" data-f="q" inputmode="numeric"></label>' +
            '<label class="ov-field"><span>Expires <em>blank = front</em></span>' +
              '<input type="date" data-f="x"></label>' +
          '</div>';
        legsEl.appendChild(d);
        renumber();
        return d;
      }

      function renumber() {
        var rows = legsEl.querySelectorAll('.ov-leg');
        for (var i = 0; i < rows.length; i++) {
          rows[i].querySelector('.ov-leg__n').textContent = 'Leg ' + (i + 1);
          // One leg is the floor: a position with none is not a position.
          rows[i].querySelector('.ov-leg__rm').hidden = rows.length < 2;
        }
        document.getElementById('mAddLeg').hidden = rows.length >= 4;
      }

      legsEl.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('.ov-leg__rm');
        if (!b) return;
        b.closest('.ov-leg').remove();
        renumber();
      });

      // Shares have no strike and no expiration of their own; hide the fields
      // rather than accept numbers that would be silently dropped.
      legsEl.addEventListener('change', function (e) {
        if (!e.target.matches('[data-f="t"]')) return;
        var row = e.target.closest('.ov-leg');
        var isShare = e.target.value === '2';
        row.classList.toggle('is-share', isShare);
        var k = row.querySelector('[data-f="k"]');
        if (isShare) k.value = '';
      });

      document.getElementById('mAddLeg').addEventListener('click', function () { legRow(); });

      function fail(msg) {
        errEl.textContent = msg;
        errEl.hidden = false;
        errEl.scrollIntoView({ block: 'center' });
        return null;
      }

      function daysBetween(a, b) {
        return Math.round((b - a) / 86400000);
      }

      function build() {
        errEl.hidden = true;
        var spot = parseFloat(document.getElementById('mSpot').value);
        if (!(spot > 0)) return fail('Enter the current price of the underlying.');
        var expStr = document.getElementById('mExp').value;
        if (!expStr) return fail('Enter the front expiration date.');
        var expParts = expStr.split('-').map(Number);
        var front = new Date(expParts[0], expParts[1] - 1, expParts[2]);

        var rows = legsEl.querySelectorAll('.ov-leg');
        var legs = [];
        for (var i = 0; i < rows.length; i++) {
          var r = rows[i];
          var g = function (f) { return r.querySelector('[data-f="' + f + '"]'); };
          var t = parseInt(g('t').value, 10);
          var q = parseInt(g('q').value, 10);
          var e = parseFloat(g('e').value);
          if (!(q > 0)) return fail('Leg ' + (i + 1) + ': enter how many contracts.');
          if (!(e >= 0)) return fail('Leg ' + (i + 1) + ': enter the entry premium per share.');
          var leg = { t: t, s: parseInt(g('s').value, 10), q: q, e: e, d: 0 };
          if (t === 2) {
            // legsFromPayload reads shares as qty x 1, so quantity is shares,
            // not contracts. 1 "contract" of stock is the 100 that covers a call.
            leg.q = q * 100;
          } else {
            var k = parseFloat(g('k').value);
            if (!(k > 0)) return fail('Leg ' + (i + 1) + ': enter a strike.');
            leg.k = k;
            var x = g('x').value;
            if (x) {
              var xp = x.split('-').map(Number);
              var d = daysBetween(front, new Date(xp[0], xp[1] - 1, xp[2]));
              if (d < 0) return fail('Leg ' + (i + 1) + ' expires before the front expiration. The earliest expiration is the front one.');
              leg.d = d;
            }
          }
          legs.push(leg);
        }
        if (!legs.length) return fail('Add at least one leg.');

        var sym = document.getElementById('mSymbol').value.trim().toUpperCase();
        var payload = {
          legs: legs,
          spot: spot,
          kind: document.getElementById('mKind').value,
          expMonth: expParts[1], expDay: expParts[2], expYear: expParts[0],
          riskFreeRate: (parseFloat(document.getElementById('mRate').value) || 0) / 100,
          dividendYield: (parseFloat(document.getElementById('mDiv').value) || 0) / 100
        };
        if (sym) payload.symbol = sym;
        return payload;
      }

      // Mirror of the share page's decoder, which does
      // decodeURIComponent(escape(atob(b64))) -- so this is its inverse, base64url
      // with the padding stripped.
      function encodePayload(obj) {
        var b64 = btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
        return b64.replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
      }

      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var p = build();
        if (!p) return;
        window.location.href = '/p/' + encodePayload(p);
      });

      legRow();
    })();
    </script>
  `, getTradeVisionPageStyles(), {
    description: 'Enter an options trade leg by leg and chart its profit and loss before expiration, in your browser.',
    url: 'https://' + APP_HOST + '/model',
    reveal: false,
  });
}

/// The Pro gate for screenshot import. The importer itself is not built yet, so
/// this page IS the paywall rather than a step in front of one -- it says what
/// the feature does, that it needs Pro, and where Pro is bought (the app, via
/// StoreKit; there is no web purchase path and this page must not imply one).
function getModelImportHTML() {
  return getLayout('Import a Robinhood Screenshot — OptionsVision Pro', `
${getStickyBarHTML('Get the App', 'https://apps.apple.com/app/id6786063635', OV_NAV_LINKS)}
    ${getOvNavHTML()}
    <div class="pf-page ov-page ov-model">
      <header class="ov-model__head">
        <p class="ov-model__pro">${OV_CROWN_SVG}OptionsVision Pro</p>
        <h1 class="ov-model__title pf-serif">Import a Robinhood screenshot</h1>
        <p class="ov-model__sub">Drop in a screenshot of your order ticket and have the strategy, strikes, expiration and premiums read off it &mdash; no typing. This is a Pro feature, and it is still being built.</p>
      </header>

      <div class="ov-gate">
        <p>Pro is unlocked in the iPhone app, where your purchase is handled by the App Store. There is no separate web subscription to buy.</p>
        <div class="ov-model__actions">
          <a class="appstore-badge" href="https://apps.apple.com/app/id6786063635" target="_blank" rel="noopener noreferrer" aria-label="Download OptionsVision on the App Store">
            ${APP_STORE_BADGE_SVG}
          </a>
          <a class="ov-btn-ghost" href="/model">Model a position by hand</a>
        </div>
      </div>

      <p class="tv-disclaimer">OptionsVision is an educational tool and is not investment advice, not a broker, and never touches your brokerage account. Figures are theoretical model estimates, not live quotes. Options involve substantial risk and are not suitable for every investor.</p>
    </div>
  `, getTradeVisionPageStyles(), {
    description: 'Import a Robinhood order-ticket screenshot into an interactive payoff chart. An OptionsVision Pro feature.',
    url: 'https://' + APP_HOST + '/model/import',
    reveal: false,
  });
}

/// The optionsvision.app landing page. Served on the product host only -- the
/// light-theme portfolio mirror this used to double as was retired 2026-07-26.
function getTradeVisionHTML() {
  return getLayout('OptionsVision — Options Payoff Charts from a Robinhood Screenshot', `
${getStickyBarHTML('Get the App', 'https://apps.apple.com/app/id6786063635', OV_NAV_LINKS)}
    ${getOvNavHTML()}
    <div class="pf-page ov-page">
      <header class="pf-hero ov-hero">
        <div class="ov-hero__copy">
          <h1 class="ov-hero__title pf-serif">Turn a Robinhood screenshot into an interactive payoff chart.</h1>
          <p class="ov-hero__sub">Model any price, date, and volatility level in seconds &mdash; 32 strategies, entirely on your device.</p>

          <div class="ov-hero__cta">
            <a class="appstore-badge" href="https://apps.apple.com/app/id6786063635" target="_blank" rel="noopener noreferrer" aria-label="Download OptionsVision on the App Store">
              ${APP_STORE_BADGE_SVG}
            </a>
          </div>

          ${/* Four claims about what the app actually computes, rather than
               three about what it does not do. Each one is defended further
               down the page: the pricing model, the Greeks and POP, and the
               earnings/dividend feed all have their own paragraph under
               "Real Analytics". */''}
          <ul class="ov-hero__proof">
            <li>32 strategies, single-leg to 4-leg</li>
            <li>Black-Scholes pre-expiration P&amp;L modeling</li>
            <li>Live Greeks and probability of profit</li>
            <li>Earnings and ex-dividend dates built in</li>
          </ul>
        </div>

        ${/* The LCP element. width/height match the file so the box is reserved
             before it decodes; the preload in getLayout starts the fetch in the
             head rather than waiting on layout. Not lazy -- it is above the
             fold on every viewport, where loading="lazy" costs a round trip. */''}
        <div class="ov-hero__frame">
          <picture>
            <source srcset="/tradevision/payoff-chart.webp" type="image/webp">
            <img class="ov-fade-in" src="/tradevision/payoff-chart.png" width="900" height="1955"
                 fetchpriority="high" decoding="async"
                 alt="OptionsVision showing an AAPL long call calendar spread: a profit-and-loss curve with both break-evens marked, and sliders for days to expiration and implied volatility.">
          </picture>
        </div>
      </header>

      ${getDemoVideosHTML()}

      <section class="tv-copy">
        ${/* This was the hero paragraph until the hero took a one-line subhead.
             Kept verbatim rather than cut: it is the clearest statement of what
             the app does on the whole page, and it belongs in the indexable
             body copy either way. */''}
        <p>Take a screenshot from Robinhood and watch it become an interactive P&amp;L chart. Model different scenarios by adjusting your days to expiration and your implied volatility. Then analyze your Greeks and break-evens, all privately on your device.</p>

        <p>OptionsVision turns any options trade into an interactive payoff chart so you can trade smarter.</p>

        <p>Brokerages like Robinhood only show you the payoff at expiration. What's missing is how to value your position before expiration and how to determine whether the option is cheap or expensive. OptionsVision solves these problems in a simple, easy to use UI.</p>

        <p>Wondering what your covered call actually looks like if the stock drops 5% with 3 days to expiration remaining? Where your calendar spread breaks even with a change in volatility? Your theta decay if you sold your option right after ex-dividend date? OptionsVision answers these questions with an interactive and accessible payoff chart.</p>

        <h2 id="how">How It Works: Screenshot to Interactive Chart in Seconds</h2>

      ${getWalkthroughCarouselHTML()}

        <h3>Import in Seconds</h3>
        <p>Take a screenshot of your Robinhood order ticket and OptionsVision reads it with Apple's on-device text recognition and automatically pre-populates the strategy, strikes, expiration, spot price, and premiums. Multi-leg trades import from two screenshots (order ticket + per-leg premium) to capture real per-leg IVs as well as multiple expiration dates for calendar spreads. Prefer to skip the screenshot? Enter any trade by hand in a few taps.</p>

        <h3>See the Whole Trade</h3>
        <p>An interactive profit-and-loss chart shows your position across the full price range: break-evens marked on the curve, max profit and max loss, and distance-to-break-even at a glance. Scrub any price to see your exact expected P&amp;L.</p>

        <h3>Watch Time and Volatility Work</h3>
        <p>Adjust days-to-expiration and IV to watch theta decay reshape your position in real time. Or flip to the at-expiration view for the standard payoff chart. As each dividend's ex-date passes, it drops out of the pricing, so the chart stays accurate.</p>

        <h3>Real Analytics</h3>
        <ul>
          <li>Black-Scholes pricing with implied volatility solved from your actual per-leg entry premiums</li>
          <li>Live Greeks: Delta, Gamma, Theta, and Vega, per share and for the whole position</li>
          <li>Risk-free rates matched to your expiration from the daily U.S. Treasury yield curve</li>
          <li>Upcoming earnings dates and projected ex-dividends for over 5,000 optionable tickers, refreshed weekly</li>
          <li>Override any assumption including rate, dividend yield, IV</li>
        </ul>

        <h3 id="strategies">Supports 32 Options Strategies</h3>
        <p>OptionsVision is built to handle each option strategy with context-aware inputs and a clear explanation of how the trade makes and loses money. Hover a group to see every strategy in it:</p>
        ${getStrategyGridHTML()}

        <h3>Private by Design</h3>
        <p>No account necessary and no ads. Your screenshots are processed entirely on your device, and your trades never leave it. The app works completely offline with tickers, earnings, IV history, and dividend data refreshing in the background each week.</p>

        <h3>Built for Learning</h3>
        <p>Sharpen how you read a trade and grow the number of options strategies you can confidently use.</p>

        <p class="tv-disclaimer">OptionsVision is an educational tool and is not investment advice, not a broker, and never touches your brokerage account. Figures are theoretical model estimates, not live quotes. Options involve substantial risk and are not suitable for every investor.</p>
      </section>

${getGuidesCarouselHTML()}

      <footer class="pf-foot">
        <p>&copy; 2026 Vishnu Muthiah. All rights reserved.</p>
        <p>
          <a href="/support">Application Support</a> &nbsp;&middot;&nbsp;
          <a href="/privacy-policy">Privacy Policy</a> &nbsp;&middot;&nbsp;
          <a href="/terms-of-service">Terms of Use</a> &nbsp;&middot;&nbsp;
          <a href="/disclaimer">Disclaimer</a> &nbsp;&middot;&nbsp;
          <a href="https://vishnumuthiah.com/">About the Developer</a>
        </p>
      </footer>
    </div>

    ${getDemoVideosScript()}
  `, getTradeVisionPageStyles(), {
    socialTitle: 'See any options trade before you place it',
    // Kept under ~100 chars so it survives the truncation most link-preview
    // clients apply; the old 187-char version was cut mid-sentence.
    description: 'Screenshot your trade and see the P&L payoff, Greeks, and break-evens privately on your phone.',
    // Purpose-built 1200x630 card. The old og:image was a portrait screenshot,
    // which every client cropped to a thin strip out of its middle.
    image: 'https://optionsvision.app/tradevision/og-card.png',
    imageWidth: 1200,
    imageHeight: 630,
    imageAlt: 'OptionsVision — an options payoff curve rising across a navy background',
    url: 'https://optionsvision.app/',
    // The hero screenshot, which became this page's LCP element when the hero
    // stopped being text-only. Not the og-card above -- that one is for
    // crawlers and is never painted.
    preloadImage: '/tradevision/payoff-chart.webp',
    // No scroll reveal here: the hero is sized so the Demo Videos band peeks
    // into the first viewport, and a band that starts invisible cannot peek.
    reveal: false,
  });
}

function getSupportHTML() {
  return getLayout('Support - Sources Tracker for Google Slides™', `
    <div class="container">
      <h1>Need help with Sources Tracker for Google Slides™?</h1>

      <h2>Contact Support</h2>
      <div class="contact-info">
        <ul>
          <li><strong>Name:</strong> Vishnu Muthiah</li>
          <li><strong>Email:</strong> <a href="mailto:VishnuAMuthiah@gmail.com">VishnuAMuthiah@gmail.com</a></li>
          <li><strong>Response Time:</strong> 48-72 hours</li>
        </ul>
      </div>

      <h2>Bug Reports</h2>
      <p>If you've encountered a bug, please email us with the following information:</p>
      <ul>
        <li>Description of the issue</li>
        <li>Steps to reproduce</li>
        <li>Screenshots (if applicable)</li>
        <li>Your browser and Google Slides version</li>
      </ul>

      <h2>Feature Requests</h2>
      <p>We'd love to hear your ideas! Email us with <strong>"Feature Request"</strong> in the subject line.</p>
      <p>Please describe:</p>
      <ul>
        <li>The feature you'd like to see</li>
        <li>How it would help your workflow</li>
        <li>Any examples or mockups (optional)</li>
      </ul>

      <a href="/" class="back-link">← Back to Products</a>
    </div>
  `, getSupportPageStyles());
}

// The portfolio's own policy, covering the Sources Tracker Slides add-on.
// OptionsVision's is a separate document -- getAppLegalHTML(), served on the
// product host. This used to take an `app` flag advertised as rendering it in
// the navy theme; nothing ever passed it, and it was never forwarded to
// getLayout, so it could not have done anything.
function getPrivacyPolicyHTML() {
  return getLayout('Privacy Policy - Vishnu Muthiah', `
    <div class="container">
      <a href="/" class="back-link">← Back to Home</a>

      <h1>Privacy Policy</h1>
      <p class="updated">Last Updated: March 3, 2026</p>

      <p>This privacy policy covers both the vishnuamuthiah.com website and the Sources Tracker for Google Slides™ add-on.</p>

      <h2>Website Privacy (vishnuamuthiah.com)</h2>
      <p>The vishnuamuthiah.com website does not collect, store, or process any personal information. The website:</p>
      <ul>
        <li>Does not use cookies or tracking technologies</li>
        <li>Does not collect email addresses or contact information</li>
        <li>Does not use analytics or advertising services</li>
        <li>Does not store any user data</li>
      </ul>
      <p>Any contact information you provide via email (VishnuAMuthiah@gmail.com) is handled according to standard email privacy practices.</p>

      <hr style="margin: 40px 0; border: none; border-top: 1px solid #dadce0;">

      <h2>Privacy Policy for Sources Tracker for Google Slides™</h2>

      <h3>Introduction</h3>
      <p>Sources Tracker for Google Slides™ ("the Add-on") is committed to protecting your privacy. This Privacy Policy explains how we handle information when you use our add-on.</p>

      <h3>Developer Information</h3>
      <p>Developer: Vishnu Muthiah<br>
      Contact Email: VishnuAMuthiah@gmail.com</p>

      <h3>1. What Data We Collect</h3>
      <p>We collect minimal data to provide our service:</p>

      <p><strong>Email Address:</strong></p>
      <ul>
        <li>We collect your Google account email address</li>
        <li>Purpose: To attribute comments you add within presentations</li>
        <li>Collection Method: Automatically obtained through Google's authentication</li>
        <li>Scope: Only your email address, no other personal information</li>
      </ul>

      <p>That's it. We do not collect:</p>
      <ul>
        <li>Presentation content</li>
        <li>Document titles or file names</li>
        <li>Browsing history</li>
        <li>Usage analytics</li>
        <li>Location data</li>
        <li>Device information</li>
        <li>Any other personal information</li>
      </ul>

      <h3>2. How We Use Your Data</h3>
      <p>Your email address is used exclusively for:</p>
      <ul>
        <li><strong>Comment Attribution:</strong> When you add a comment to a slide or source, your email (specifically, the username portion before the @ symbol) is displayed as the comment author</li>
        <li><strong>In-Document Display Only:</strong> This information only appears within the presentation you're working on</li>
        <li><strong>No Other Purpose:</strong> We do not use your email for marketing, communication, analytics, or any other purpose</li>
      </ul>
      <p>Example: If your email is VishnuAMuthiah@gmail.com, comments you add will show "VishnuAMuthiah" as the author.</p>

      <h3>3. Data Storage</h3>
      <p>All data stays within Google's infrastructure:</p>
      <ul>
        <li><strong>Storage Method:</strong> Google Apps Script CacheService and PropertiesService</li>
        <li><strong>Storage Location:</strong> Google's secure servers</li>
        <li><strong>Document Scope:</strong> We use the @OnlyCurrentDoc annotation, which means the add-on can only access the specific presentation you're currently working on—not your other files</li>
      </ul>

      <p><strong>What We Store:</strong></p>
      <ul>
        <li>Comments & Source Metadata: Stored in Document Properties (persists indefinitely within the document)</li>
        <li>Temporary Scan Data: Stored in Document Cache (expires after 30 days)</li>
        <li>Comment Backups: Stored in Document Properties (persists indefinitely as protection against data loss)</li>
      </ul>

      <p><strong>No External Storage:</strong></p>
      <ul>
        <li>We do NOT store any data on external servers or databases</li>
        <li>We do NOT use any third-party cloud storage services</li>
        <li>Your data never leaves Google's ecosystem</li>
      </ul>

      <p><strong>Important Change (December 2025):</strong> We no longer cache document titles. Previous versions cached titles in Script Properties and Script Cache for performance optimization. This functionality has been removed to minimize data collection.</p>

      <h3>4. Data Retention</h3>
      <p><strong>Automatic Deletion:</strong></p>
      <ul>
        <li>Temporary scan cache: 30 days (automatic deletion)</li>
        <li>Comments, sources, and metadata: Stored indefinitely in document properties until manually deleted</li>
      </ul>

      <p><strong>To Delete Your Data:</strong></p>
      <ul>
        <li>Delete individual comments through the add-on interface</li>
        <li>Use "⚠️ Delete All Data (Sources & Comments)" from the Extensions menu to clear all stored data</li>
        <li>Delete the presentation to remove all associated data</li>
        <li>Uninstall the add-on AND manually clear document properties (uninstalling alone does not remove stored data)</li>
      </ul>

      <p>No Backup Copies: We do not create or maintain backup copies of your data outside of the automatic in-document backup system</p>

      <h3>5. Third-Party Sharing</h3>
      <p>We do NOT share your data with anyone:</p>
      <ul>
        <li>No third-party services</li>
        <li>No advertising networks</li>
        <li>No analytics companies</li>
        <li>No data brokers</li>
        <li>No partners or affiliates</li>
        <li>No government entities (except as required by law)</li>
      </ul>
      <p>The only exception: We may disclose information if required by law, such as in response to a valid legal subpoena or court order.</p>

      <h3>6. Your Rights</h3>
      <p>You have complete control over your data:</p>

      <p><strong>Right to Access:</strong></p>
      <ul>
        <li>All data we store is visible within your presentation (your comments)</li>
        <li>You can view all sources and comments at any time through the add-on sidebar</li>
      </ul>

      <p><strong>Right to Delete:</strong></p>
      <ul>
        <li>Delete comments individually via the add-on interface</li>
        <li>Delete all data at once using "⚠️ Delete All Data (Sources & Comments)" menu option</li>
        <li>Note: Uninstalling does not automatically remove stored data from document properties</li>
        <li>Revoke permissions through Google Account settings at https://myaccount.google.com/permissions</li>
      </ul>

      <p><strong>Right to Revoke Access:</strong></p>
      <ul>
        <li>You can revoke the add-on's permissions at any time</li>
        <li>Go to Google Account → Security → Third-party apps with account access</li>
        <li>Remove "Sources Tracker for Google Slides™"</li>
      </ul>

      <p><strong>Right to Portability:</strong></p>
      <ul>
        <li>Export all your sources and comments using the "Generate Summary File" feature</li>
        <li>This creates a Google Sheets™ file with all your data that you can download</li>
      </ul>

      <p><strong>Right to Complain:</strong></p>
      <ul>
        <li>If you have concerns about how we handle your data, contact us at VishnuAMuthiah@gmail.com</li>
        <li>You can also file a complaint with your local data protection authority</li>
      </ul>

      <h3>Google API Services User Data Policy Compliance</h3>
      <p>Sources Tracker's use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.</p>

      <p><strong>Our Compliance:</strong></p>
      <ul>
        <li>We only request the minimum OAuth scopes necessary for functionality</li>
        <li>We do not use data for advertising or marketing purposes</li>
        <li>We do not share data with third parties for advertising or marketing</li>
        <li>We do not use data for creditworthiness or lending purposes</li>
        <li>All data handling is transparent and disclosed in this policy</li>
      </ul>

      <h3>OAuth Scopes and Permissions</h3>
      <p>The add-on requests these Google account permissions:</p>

      <p><strong>1. https://www.googleapis.com/auth/userinfo.email</strong></p>
      <ul>
        <li>Purpose: To identify who added comments</li>
        <li>Usage: Displays your username on comments you create</li>
        <li>Data Access: Your email address only</li>
      </ul>

      <p><strong>2. https://www.googleapis.com/auth/presentations</strong></p>
      <ul>
        <li>Purpose: To read and analyze your presentation</li>
        <li>Usage: Scans slides for hyperlinks, embedded content, and sources using the Slides API</li>
        <li>Data Access: Content of the current presentation only</li>
      </ul>

      <p><strong>3. https://www.googleapis.com/auth/drive.file</strong></p>
      <ul>
        <li>Purpose: To create summary export files</li>
        <li>Usage: Generates Google Sheets™ reports when you use the "Generate Summary File" feature</li>
        <li>Data Access: Create and edit files created by this add-on only (not access to your other Drive files)</li>
        <li>Note: Summary files are created in your root Drive folder; you can manually move them as needed</li>
      </ul>

      <p><strong>4. https://www.googleapis.com/auth/spreadsheets</strong></p>
      <ul>
        <li>Purpose: To create summary export files</li>
        <li>Usage: Generates Google Sheets™ reports when you use the "Generate Summary File" feature</li>
        <li>Data Access: Creates new spreadsheet files only</li>
      </ul>

      <p><strong>5. https://www.googleapis.com/auth/script.storage</strong></p>
      <ul>
        <li>Purpose: Store add-on settings and data persistently</li>
        <li>Usage: Save comments, sources, and scan data that persist across sessions</li>
        <li>Data Access: Read/write access to key-value storage specific to this add-on within the current document (PropertiesService data)</li>
      </ul>

      <p><strong>6. https://www.googleapis.com/auth/script.container.ui</strong></p>
      <ul>
        <li>Purpose: To display the add-on interface</li>
        <li>Usage: Shows the sidebar with sources, comments, and controls</li>
        <li>Data Access: No data access - only displays UI elements</li>
      </ul>

      <p><strong>7. https://www.googleapis.com/auth/script.scriptapp</strong></p>
      <ul>
        <li>Purpose: To execute add-on functions and obtain OAuth tokens</li>
        <li>Usage: Runs the add-on's core functionality (scanning, commenting, exporting) and secures API authentication</li>
        <li>Data Access: No additional data access - enables script execution and API authentication</li>
      </ul>

      <p><strong>8. https://www.googleapis.com/auth/script.external_request</strong></p>
      <ul>
        <li>Purpose: To make authenticated API calls to Google services</li>
        <li>Usage: Enables communication with Google Slides and Sheets APIs for data retrieval and export generation</li>
        <li>Data Access: No direct data access - enables network requests to Google APIs</li>
      </ul>

      <p><strong>Removed Scope (December 2025):</strong></p>
      <ul>
        <li><strong>drive.readonly</strong> - Previously used to fetch document titles for linked files. This scope has been removed to minimize data access. The add-on no longer displays document titles for linked Google Drive files.</li>
      </ul>

      <p><strong>Important:</strong> All permissions are used only as described. We request the minimum scopes necessary for the add-on to function.</p>

      <h3>Data Security</h3>
      <p>We take security seriously:</p>
      <ul>
        <li><strong>Google's Infrastructure:</strong> All data is stored using Google's secure CacheService and PropertiesService</li>
        <li><strong>Encrypted Transit:</strong> All data transmission uses HTTPS encryption</li>
        <li><strong>No Passwords:</strong> We never ask for or store your password</li>
        <li><strong>Access Control:</strong> Only you can access your presentation data</li>
        <li><strong>Regular Updates:</strong> We maintain the add-on with security best practices</li>
      </ul>

      <h3>Children's Privacy</h3>
      <p>Sources Tracker is not directed to children under the age of 13 (or the minimum age in your country). We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us at VishnuAMuthiah@gmail.com and we will take steps to delete such information.</p>

      <h3>International Data Transfers</h3>
      <p>The add-on operates within Google's global infrastructure. Your data may be processed in any country where Google operates data centers. Google complies with applicable data protection laws, including:</p>
      <ul>
        <li>EU-US Data Privacy Framework</li>
        <li>UK-US Data Privacy Framework</li>
        <li>Swiss-US Data Privacy Framework</li>
      </ul>

      <h3>Cookies and Tracking</h3>
      <p>We do NOT use:</p>
      <ul>
        <li>Cookies</li>
        <li>Tracking pixels</li>
        <li>Analytics tools</li>
        <li>Advertising identifiers</li>
        <li>Any other tracking technologies</li>
      </ul>

      <h3>Data Breach Notification</h3>
      <p>In the unlikely event of a data breach that affects your personal information, we will:</p>
      <ul>
        <li>Notify you via email within 72 hours of discovering the breach</li>
        <li>Describe what data was affected</li>
        <li>Explain steps we're taking to address the breach</li>
        <li>Provide guidance on protecting yourself</li>
      </ul>

      <h3>Changes to This Privacy Policy</h3>
      <p>We may update this Privacy Policy from time to time. When we make changes:</p>
      <ul>
        <li>We will update the "Last Updated" date at the top of this policy</li>
        <li>Significant changes will be announced through the add-on interface</li>
        <li>Continued use of the add-on after changes constitutes acceptance</li>
      </ul>

      <p><strong>Version History:</strong></p>
      <ul>
        <li>v1.2 (December 1, 2025): Removed drive.readonly scope and document title caching; updated OAuth scope descriptions; clarified data deletion options</li>
        <li>v1.1 (November 23, 2025): Added website privacy section</li>
        <li>v1.0 (November 21, 2025): Initial version</li>
      </ul>

      <h3>Your Consent</h3>
      <p>By using Sources Tracker for Google Slides™, you consent to this Privacy Policy and our handling of data as described herein.</p>

      <h3>Legal Basis for Processing (GDPR)</h3>
      <p>For users in the European Economic Area (EEA), United Kingdom, or Switzerland, our legal basis for processing your personal data is:</p>
      <ul>
        <li><strong>Consent:</strong> You provide explicit consent when you install and authorize the add-on</li>
        <li><strong>Legitimate Interest:</strong> Processing is necessary for the legitimate interest of providing the service you requested</li>
        <li><strong>Contract Performance:</strong> Processing is necessary to perform the service contract between you and us</li>
      </ul>

      <h3>California Privacy Rights (CCPA)</h3>
      <p>If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):</p>
      <ul>
        <li><strong>Right to Know:</strong> What personal information we collect and how we use it</li>
        <li><strong>Right to Delete:</strong> Request deletion of your personal information</li>
        <li><strong>Right to Opt-Out:</strong> Opt-out of the "sale" of personal information (Note: We do NOT sell personal information)</li>
        <li><strong>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising your CCPA rights</li>
      </ul>
      <p>To exercise these rights, contact us at VishnuAMuthiah@gmail.com.</p>

      <h3>Additional Disclosures</h3>
      <ul>
        <li><strong>Business Transfers:</strong> If Sources Tracker is acquired or merged with another entity, your data will be transferred to the new owner, who will continue to honor this Privacy Policy.</li>
        <li><strong>Legal Requirements:</strong> We may disclose data if required to comply with legal obligations, protect our rights or property, prevent fraud or abuse, or protect the safety of users.</li>
        <li><strong>No Selling of Data:</strong> We do NOT sell, rent, or lease your personal information to third parties under any circumstances.</li>
      </ul>

      <h3>Contact Us</h3>
      <p>If you have questions, concerns, or requests regarding this Privacy Policy or your data:</p>
      <p>Developer: Vishnu Muthiah<br>
      Email: VishnuAMuthiah@gmail.com<br>
      Response Time: We aim to respond within 48 hours</p>

      <p>You can contact us to:</p>
      <ul>
        <li>Ask questions about this policy</li>
        <li>Request access to your data</li>
        <li>Request deletion of your data</li>
        <li>Report privacy concerns</li>
        <li>Request policy clarification</li>
      </ul>

      <h3>Summary</h3>
      <p>We only collect your email address to attribute comments you create within presentations. Comments, sources, and metadata are stored in the document's properties using Google's secure infrastructure. We no longer cache document titles or access Drive metadata. We never share your data with third parties, and all data stays within Google's ecosystem. You can delete individual comments through the add-on interface, delete all data using the "⚠️ Delete All Comments ⚠️" menu option, or export all your data using the "Generate Summary File" feature. Summary files are created in your root Drive folder for easy access. Questions? Email VishnuAMuthiah@gmail.com.</p>

      <footer>
        <p>&copy; 2026 Vishnu Muthiah. All rights reserved.</p>
        <p style="margin-top: 10px;">
          <a href="/">Home</a> |
          <a href="/terms-of-service">Terms of Service</a>
        </p>
      </footer>
    </div>
  `, getLegalPageStyles());
}

// The portfolio's own terms, covering the Sources Tracker Slides add-on. Same
// story as getPrivacyPolicyHTML above: the `app` flag was inert.
function getTermsOfServiceHTML() {
  return getLayout('Terms of Service - Vishnu Muthiah', `
    <div class="container">
      <a href="/" class="back-link">← Back to Home</a>

      <h1>Terms of Service</h1>
      <p class="updated">Last Updated: December 1, 2025</p>

      <p>This Terms of Service covers both the vishnuamuthiah.com website and the Sources Tracker for Google Slides™ add-on.</p>

      <h2>Website Terms of Service (vishnuamuthiah.com)</h2>

      <h3>Agreement to Terms</h3>
      <p>By accessing vishnuamuthiah.com ("the Website"), you agree to these terms.</p>

      <h3>Use of Website</h3>
      <p>The Website is provided for informational purposes only. You may:</p>
      <ul>
        <li>View and browse the Website content</li>
        <li>Contact us via the provided email address</li>
        <li>Access links to products and services</li>
      </ul>

      <p>The Website does not:</p>
      <ul>
        <li>Collect or store personal information</li>
        <li>Use cookies or tracking technologies</li>
        <li>Require account creation or login</li>
        <li>Offer any warranties or guarantees</li>
      </ul>

      <h3>Content</h3>
      <p>All content on the Website, including text, images, and design, is owned by Vishnu Muthiah and protected by copyright law. You may not reproduce, distribute, or create derivative works without permission.</p>

      <h3>Limitation of Liability</h3>
      <p>The Website is provided "as is" without warranties of any kind. Vishnu Muthiah is not liable for any damages arising from use of the Website.</p>

      <h3>External Links</h3>
      <p>The Website may contain links to third-party websites or services. We are not responsible for the content or practices of external sites.</p>

      <h3>Contact</h3>
      <p>For questions about the Website: VishnuAMuthiah@gmail.com</p>

      <hr style="margin: 40px 0; border: none; border-top: 1px solid #dadce0;">

      <h2>Terms of Service for Sources Tracker for Google Slides™</h2>

      <h3>Agreement to Terms</h3>
      <p>By installing, accessing, or using Sources Tracker for Google Slides™ ("the Add-on"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Add-on.</p>

      <h3>Developer Information</h3>
      <p>Developer: Vishnu Muthiah<br>
      Contact Email: VishnuAMuthiah@gmail.com</p>

      <h3>Description of Service</h3>
      <p>Sources Tracker for Google Slides™ is a Google Workspace™ Add-on that provides the following features:</p>
      <ul>
        <li><strong>Automatic Source Detection:</strong> Scans presentations for hyperlinks, embedded content, videos, and other sources</li>
        <li><strong>Source Management:</strong> Organizes and displays sources in an interactive sidebar interface</li>
        <li><strong>Commenting System:</strong> Allows users to add comments and annotations to slides and sources with threaded replies</li>
        <li><strong>Export Functionality:</strong> Generates Google Sheets™ summaries of all sources and comments (saved to your root Drive folder)</li>
        <li><strong>Collaboration Tools:</strong> Supports team collaboration with threaded comments and author attribution</li>
        <li><strong>Backup & Recovery:</strong> Automatic comment backups and recovery system to protect against data loss</li>
      </ul>

      <h3>1. Acceptable Use Policy</h3>

      <p><strong>You Agree To:</strong></p>
      <p>Permitted Uses:</p>
      <ul>
        <li>Use the Add-on for personal, educational, or commercial presentations</li>
        <li>Share presentations containing sources tracked by the Add-on</li>
        <li>Use the Add-on to manage citations and references</li>
        <li>Export summaries for documentation purposes</li>
        <li>Collaborate with team members using the commenting features</li>
      </ul>

      <p><strong>You Agree NOT To:</strong></p>
      <p>Prohibited Uses:</p>
      <ul>
        <li>Use the Add-on for any illegal or unauthorized purpose</li>
        <li>Violate any laws, regulations, or third-party rights</li>
        <li>Attempt to reverse engineer, decompile, or disassemble the Add-on</li>
        <li>Remove, alter, or obscure any copyright or proprietary notices</li>
        <li>Use the Add-on to harass, abuse, or harm others</li>
        <li>Distribute malware, spam, or malicious content through the Add-on</li>
        <li>Attempt to gain unauthorized access to the Add-on's systems</li>
        <li>Use the Add-on to violate Google's Terms of Service or Acceptable Use Policy</li>
        <li>Interfere with or disrupt the Add-on's functionality</li>
        <li>Use automated systems (bots, scrapers) to access the Add-on</li>
        <li>Resell, sublicense, or redistribute the Add-on without permission</li>
        <li>Use the Add-on to infringe on intellectual property rights</li>
        <li>Submit false, misleading, or fraudulent information</li>
      </ul>

      <p><strong>Consequences of Violation:</strong></p>
      <p>If you violate these terms, we may:</p>
      <ul>
        <li>Suspend or terminate your access to the Add-on</li>
        <li>Report violations to Google</li>
        <li>Take legal action if necessary</li>
        <li>Notify appropriate authorities for illegal activities</li>
      </ul>

      <h3>2. Service Availability Disclaimer</h3>

      <p><strong>No Guarantee of Service</strong></p>
      <p>The Add-on is provided "AS IS" and "AS AVAILABLE." We do not guarantee:</p>
      <ul>
        <li>Uninterrupted or error-free operation</li>
        <li>That the Add-on will meet your specific requirements</li>
        <li>That all bugs or errors will be corrected</li>
        <li>Continuous availability or uptime</li>
        <li>Compatibility with all Google Slides™ features or future updates</li>
        <li>That the Add-on will always be free</li>
        <li>Data accuracy or completeness</li>
      </ul>

      <p><strong>Service Interruptions</strong></p>
      <p>The Add-on may be unavailable due to:</p>
      <ul>
        <li>Scheduled maintenance</li>
        <li>Emergency repairs</li>
        <li>Google API changes or outages</li>
        <li>Internet connectivity issues</li>
        <li>Force majeure events (natural disasters, pandemics, etc.)</li>
        <li>Third-party service provider issues</li>
      </ul>

      <p>We will attempt to provide notice of planned maintenance when possible, but are not obligated to do so.</p>

      <p><strong>No Service Level Agreement (SLA)</strong></p>
      <p>We do not provide a Service Level Agreement. The Add-on is offered on a best-effort basis.</p>

      <p><strong>Beta Features</strong></p>
      <p>Some features may be marked as "beta" or "experimental." These features:</p>
      <ul>
        <li>May not work as expected</li>
        <li>May be changed or removed without notice</li>
        <li>Are provided for testing and feedback purposes only</li>
      </ul>

      <p><strong>Data Caching and Expiration</strong></p>
      <p>Please note that certain data is cached temporarily to improve performance:</p>
      <ul>
        <li>Temporary scan data (Document Cache): Expires after 30 days</li>
        <li>Comments, sources, and metadata: Stored indefinitely in document properties until manually deleted</li>
      </ul>

      <p><strong>Important Change (December 2025):</strong> We no longer cache document titles. Previous versions cached titles in Script Properties and Script Cache. This functionality has been removed to minimize data collection.</p>

      <h3>3. Limitation of Liability</h3>

      <p><strong>Disclaimer of Warranties</strong></p>
      <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE ADD-ON IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:</p>
      <ul>
        <li>Warranties of merchantability</li>
        <li>Fitness for a particular purpose</li>
        <li>Non-infringement</li>
        <li>Title</li>
        <li>Accuracy or reliability</li>
        <li>Freedom from viruses or harmful code</li>
      </ul>

      <p><strong>Limitation of Damages</strong></p>
      <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, VISHNU MUTHIAH SHALL NOT BE LIABLE FOR:</p>

      <p>Indirect or Consequential Damages:</p>
      <ul>
        <li>Loss of profits, revenue, or business opportunities</li>
        <li>Loss of data or information</li>
        <li>Business interruption or downtime</li>
        <li>Loss of goodwill or reputation</li>
        <li>Procurement of substitute goods or services</li>
        <li>Any indirect, incidental, special, consequential, or punitive damages</li>
      </ul>

      <p>Direct Damages:</p>
      <ul>
        <li>Even for direct damages, our maximum liability is limited to $50 USD or the amount you paid for the Add-on in the past 12 months, whichever is greater</li>
        <li>Since the Add-on is currently free, this means our maximum liability is $50 USD</li>
      </ul>

      <p><strong>Exclusions</strong></p>
      <p>Some jurisdictions do not allow the exclusion or limitation of certain warranties or damages. In such jurisdictions, our liability is limited to the maximum extent permitted by law.</p>

      <p><strong>Allocation of Risk</strong></p>
      <p>These limitations reflect an allocation of risk between you and us. The limitations will apply even if we have been advised of the possibility of damages.</p>

      <h3>4. User Responsibilities</h3>

      <p>As a user of the Add-on, you are responsible for:</p>

      <p><strong>Your Content</strong></p>
      <ul>
        <li><strong>Accuracy:</strong> Ensuring your presentations and sources are accurate</li>
        <li><strong>Legality:</strong> Ensuring your content complies with applicable laws</li>
        <li><strong>Rights:</strong> Ensuring you have rights to all content you use</li>
        <li><strong>Backup:</strong> Maintaining backup copies of your presentations (while the Add-on includes automatic backup features, you should maintain your own backups)</li>
        <li><strong>Confidentiality:</strong> Protecting sensitive or confidential information</li>
      </ul>

      <p><strong>Your Account</strong></p>
      <ul>
        <li><strong>Security:</strong> Maintaining the security of your Google account</li>
        <li><strong>Credentials:</strong> Keeping your login credentials confidential</li>
        <li><strong>Authorized Use:</strong> Ensuring only authorized persons use your account</li>
        <li><strong>Activity:</strong> You are responsible for all activity under your account</li>
      </ul>

      <p><strong>Compliance</strong></p>
      <ul>
        <li><strong>Google's Terms:</strong> Complying with Google Workspace™ Terms of Service</li>
        <li><strong>Laws:</strong> Complying with all applicable local, national, and international laws</li>
        <li><strong>Third-Party Rights:</strong> Respecting intellectual property and other rights of third parties</li>
      </ul>

      <p><strong>Prohibited Content</strong></p>
      <p>You may not use the Add-on to track, manage, or share sources that contain:</p>
      <ul>
        <li>Illegal content</li>
        <li>Hate speech or discriminatory content</li>
        <li>Explicit or adult content involving minors</li>
        <li>Malware or malicious code</li>
        <li>Spam or deceptive content</li>
        <li>Content that violates others' privacy or intellectual property rights</li>
      </ul>

      <h3>5. Termination Conditions</h3>

      <p><strong>Termination by You</strong></p>
      <p>You may stop using the Add-on at any time by:</p>
      <ul>
        <li>Uninstalling the Add-on from your presentation</li>
        <li>Revoking OAuth permissions in your Google Account settings</li>
        <li>Ceasing to use the Add-on's features</li>
      </ul>

      <p>Effect of Your Termination:</p>
      <ul>
        <li>Your temporary scan data (Document Cache) will expire within 30 days</li>
        <li>Comments, sources, and metadata will remain in document properties unless manually deleted using "⚠️ Delete All Comments ⚠️" menu option</li>
        <li>Comment backups will remain in Properties Service unless manually deleted</li>
        <li>You can reinstall the Add-on at any time</li>
        <li>Your exported summaries (Google Sheets™) will remain in your Drive</li>
      </ul>

      <p><strong>Termination by Us</strong></p>
      <p>We may suspend or terminate your access to the Add-on if:</p>
      <ul>
        <li>You violate these Terms of Service</li>
        <li>You violate Google's Terms of Service</li>
        <li>We receive a legal order requiring termination</li>
        <li>Your use poses a security risk</li>
        <li>Your use causes harm to other users or the service</li>
        <li>We detect fraudulent, abusive, or illegal activity</li>
      </ul>

      <p>Notice of Termination:</p>
      <ul>
        <li>We will attempt to provide reasonable notice before termination</li>
        <li>In cases of serious violations, we may terminate immediately without notice</li>
      </ul>

      <p>Effect of Our Termination:</p>
      <ul>
        <li>You will lose access to the Add-on</li>
        <li>Your cached data will be deleted according to normal expiration schedules</li>
        <li>You may not be permitted to reinstall the Add-on</li>
        <li>We may report violations to Google or authorities as appropriate</li>
      </ul>

      <p><strong>Survival</strong></p>
      <p>The following sections survive termination:</p>
      <ul>
        <li>Limitation of Liability</li>
        <li>Intellectual Property Rights</li>
        <li>Indemnification</li>
        <li>Governing Law and Dispute Resolution</li>
      </ul>

      <h3>6. Updates to Terms</h3>

      <p><strong>Right to Modify</strong></p>
      <p>We reserve the right to modify these Terms at any time. When we make changes:</p>

      <p>Notice of Changes:</p>
      <ul>
        <li>We will update the "Last Updated" date at the top of these Terms</li>
        <li>For material changes, we will notify you through:
          <ul>
            <li>A notice in the Add-on interface</li>
            <li>An email to your Google account (if available)</li>
            <li>A prominent notice on our policy page</li>
          </ul>
        </li>
      </ul>

      <p>Timing:</p>
      <ul>
        <li>Changes become effective 30 days after notice for material changes</li>
        <li>Changes become effective immediately for non-material changes</li>
      </ul>

      <p><strong>Your Acceptance</strong></p>
      <p>Continued use of the Add-on after changes constitutes acceptance of the updated Terms.</p>

      <p>If you do not agree to the updated Terms:</p>
      <ul>
        <li>Stop using the Add-on</li>
        <li>Uninstall the Add-on from your presentations</li>
        <li>Contact us with concerns at VishnuAMuthiah@gmail.com</li>
      </ul>

      <p><strong>Version History</strong></p>
      <p>We will maintain a version history of these Terms:</p>
      <ul>
        <li>v1.2 (December 1, 2025): Removed document title caching references; updated data deletion instructions</li>
        <li>v1.1 (November 23, 2025): Added website terms section</li>
        <li>v1.0 (November 21, 2025): Initial version</li>
      </ul>

      <h3>7. Intellectual Property Rights</h3>

      <p><strong>Our Rights</strong></p>
      <p>Ownership:</p>
      <ul>
        <li>The Add-on, including all code, design, text, graphics, and functionality, is owned by Vishnu Muthiah</li>
        <li>The Add-on is protected by copyright, trademark, and other intellectual property laws</li>
        <li>All rights not expressly granted to you are reserved by us</li>
      </ul>

      <p>License Grant: We grant you a limited, non-exclusive, non-transferable, revocable license to:</p>
      <ul>
        <li>Install and use the Add-on</li>
        <li>Access the Add-on's features</li>
        <li>Create and export summaries using the Add-on</li>
      </ul>

      <p>Restrictions: You may NOT:</p>
      <ul>
        <li>Copy, modify, or create derivative works of the Add-on</li>
        <li>Sell, rent, lease, or sublicense the Add-on</li>
        <li>Reverse engineer or decompile the Add-on</li>
        <li>Remove or alter copyright notices</li>
        <li>Use the Add-on to create competing products</li>
      </ul>

      <p><strong>Your Rights</strong></p>
      <p>Your Content:</p>
      <ul>
        <li>You retain all rights to your presentations and content</li>
        <li>We do not claim ownership of your presentations or sources</li>
        <li>You grant us a limited license to process your content solely to provide the Add-on's functionality</li>
      </ul>

      <p>Your Exports:</p>
      <ul>
        <li>You own the Google Sheets™ summaries created by the Add-on</li>
        <li>You may use, share, or modify these summaries as you see fit</li>
        <li>Export files are created in your root Google Drive™ folder; you may move them to any location</li>
      </ul>

      <p><strong>Trademarks</strong></p>
      <p>"Sources Tracker" and any associated logos are trademarks of Vishnu Muthiah. You may not use these trademarks without permission.</p>
      <p>"Google," "Google Slides," "Google Drive," and related marks are trademarks of Google LLC. This Add-on is not officially associated with or endorsed by Google.</p>

      <h3>8. Privacy and Data Protection</h3>
      <p>Your use of the Add-on is also governed by our Privacy Policy, which is incorporated into these Terms by reference.</p>

      <p>Key Points:</p>
      <ul>
        <li>We only collect your email for comment attribution</li>
        <li>Data retention: temporary scan data (30 days), comments/sources stored permanently in document properties until manually deleted</li>
        <li>We never share your data with third parties</li>
        <li>You can delete your data at any time using the "⚠️ Delete All Data (Sources & Comments)" menu option</li>
        <li>We no longer cache document titles (removed December 2025)</li>
      </ul>

      <p>Full Privacy Policy: <a href="/privacy-policy">vishnuamuthiah.com/privacy-policy</a></p>

      <h3>9. Indemnification</h3>
      <p>You agree to indemnify, defend, and hold harmless Vishnu Muthiah from any claims, damages, losses, liabilities, costs, and expenses (including reasonable attorney fees) arising from:</p>
      <ul>
        <li>Your use or misuse of the Add-on</li>
        <li>Your violation of these Terms</li>
        <li>Your violation of any law or third-party rights</li>
        <li>Your content or presentations</li>
        <li>Your negligence or willful misconduct</li>
      </ul>
      <p>This indemnification obligation survives termination of these Terms.</p>

      <h3>10. Third-Party Services</h3>
      <p>The Add-on relies on third-party services, including:</p>
      <ul>
        <li>Google Workspace APIs</li>
        <li>Google Slides™</li>
        <li>Google Drive™</li>
        <li>Google Sheets™</li>
      </ul>

      <p>Your Responsibility:</p>
      <ul>
        <li>You must comply with Google's Terms of Service</li>
        <li>We are not responsible for changes, interruptions, or issues with Google's services</li>
        <li>Third-party terms may also apply to your use of the Add-on</li>
      </ul>

      <h3>11. Feedback and Suggestions</h3>
      <p>If you provide feedback, suggestions, or ideas about the Add-on:</p>
      <ul>
        <li>You grant us a perpetual, irrevocable, worldwide, royalty-free license to use such feedback</li>
        <li>We may implement your suggestions without compensation or attribution</li>
        <li>You waive any rights to such feedback or implementations</li>
      </ul>

      <h3>12. Governing Law and Dispute Resolution</h3>
      <p><strong>Governing Law</strong></p>
      <p>These Terms are governed by the laws of Virginia, United States, without regard to conflict of law principles. Any disputes shall be resolved in the courts of Virginia.</p>

      <h3>13. General Provisions</h3>

      <p><strong>Entire Agreement</strong></p>
      <p>These Terms, together with our Privacy Policy, constitute the entire agreement between you and us regarding the Add-on.</p>

      <p><strong>Severability</strong></p>
      <p>If any provision of these Terms is found to be unenforceable, the remaining provisions will remain in full effect.</p>

      <p><strong>No Waiver</strong></p>
      <p>Our failure to enforce any right or provision does not constitute a waiver of that right or provision.</p>

      <p><strong>Assignment</strong></p>
      <p>You may not assign or transfer these Terms without our consent. We may assign these Terms without restriction.</p>

      <p><strong>Force Majeure</strong></p>
      <p>We are not liable for delays or failures caused by circumstances beyond our reasonable control, including:</p>
      <ul>
        <li>Natural disasters</li>
        <li>War or terrorism</li>
        <li>Government actions</li>
        <li>Internet or utility failures</li>
        <li>Pandemics or health emergencies</li>
      </ul>

      <p><strong>Language</strong></p>
      <p>These Terms are written in English. Any translations are provided for convenience only. The English version controls.</p>

      <p><strong>Headings</strong></p>
      <p>Section headings are for convenience only and do not affect interpretation of these Terms.</p>

      <h3>14. DMCA and Copyright</h3>
      <p>If you believe your copyrighted work has been used in a way that constitutes copyright infringement through the Add-on:</p>

      <p>Notice Requirements: Contact us at VishnuAMuthiah@gmail.com with:</p>
      <ul>
        <li>Description of the copyrighted work</li>
        <li>Location of the infringing material</li>
        <li>Your contact information</li>
        <li>A statement of good faith belief</li>
        <li>A statement under penalty of perjury</li>
        <li>Your physical or electronic signature</li>
      </ul>

      <p>We will investigate and take appropriate action under the Digital Millennium Copyright Act (DMCA).</p>

      <h3>15. Age Requirements</h3>
      <p>The Add-on is not directed to children under 13 (or the minimum age in your country). By using the Add-on, you represent that you meet the minimum age requirements.</p>

      <h3>16. Export Compliance</h3>
      <p>You agree to comply with all applicable export and import laws. You may not use the Add-on if you are located in an embargoed country or are on a restricted parties list.</p>

      <h3>17. Accessibility</h3>
      <p>We strive to make the Add-on accessible to all users. If you experience accessibility issues, please contact us at VishnuAMuthiah@gmail.com.</p>

      <h3>18. Questions and Support</h3>

      <p><strong>Contact Information</strong></p>
      <p>Developer: Vishnu Muthiah<br>
      Email: VishnuAMuthiah@gmail.com<br>
      Response Time: We aim to respond within 48-72 hours</p>

      <p><strong>What We Can Help With:</strong></p>
      <ul>
        <li>Technical support questions</li>
        <li>Feature requests</li>
        <li>Bug reports</li>
        <li>Privacy concerns</li>
        <li>Terms clarification</li>
        <li>Account issues</li>
      </ul>

      <p><strong>What to Include in Support Requests:</strong></p>
      <ul>
        <li>Clear description of the issue</li>
        <li>Steps to reproduce (if applicable)</li>
        <li>Screenshots (if helpful)</li>
        <li>Your Google Slides™ version</li>
        <li>Browser information</li>
      </ul>

      <h3>19. Acknowledgment</h3>
      <p>By using Sources Tracker for Google Slides™, you acknowledge that:</p>
      <ul>
        <li>You have read and understood these Terms</li>
        <li>You agree to be bound by these Terms</li>
        <li>You have the authority to enter into this agreement</li>
        <li>These Terms constitute a legally binding agreement</li>
      </ul>

      <h3>Summary</h3>
      <p>In Plain English:</p>
      <ul>
        <li>Use the Add-on responsibly and legally</li>
        <li>We provide the service "as is" without guarantees</li>
        <li>We're not liable for damages beyond $50 USD</li>
        <li>You're responsible for your content and account security</li>
        <li>We can update these Terms with notice</li>
        <li>Use "⚠️ Delete All Comments ⚠️" to clear all stored data</li>
        <li>Contact us if you have questions: VishnuAMuthiah@gmail.com</li>
      </ul>

      <footer>
        <p>&copy; 2025 Vishnu Muthiah. All rights reserved.</p>
        <p style="margin-top: 10px;">
          <a href="/">Home</a> |
          <a href="/privacy-policy">Privacy Policy</a>
        </p>
      </footer>
    </div>
  `, getLegalPageStyles());
}
