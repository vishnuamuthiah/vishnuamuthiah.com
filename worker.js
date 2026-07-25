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

// Hostname of the OptionsVision product site. One Worker serves both sites; the
// router branches on this so the app domain gets the app's navy theme and a
// product homepage, while vishnumuthiah.com stays the light portfolio.
const APP_HOST = 'optionsvision.app';

function html(body) {
  return new Response(body, {
    headers: { "content-type": "text/html;charset=UTF-8" },
  });
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

export default {
  async fetch(request, env, ctx) {
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
        return html(getAppLegalHTML(APP_LEGAL_ROUTES[path]));

      } else if (path === '/support') {
        return html(getAppSupportHTML());

      } else if (path === '/') {
        return html(getTradeVisionHTML({ app: true }));

      } else if (path === '/learn' || path === '/learn/') {
        return html(getLearningLibraryHTML());

      } else if (path.startsWith('/learn/')) {
        // An unknown slug is not a guide; fall through to the root redirect below
        // rather than serving an empty page for anything under /learn/.
        const slug = path.slice('/learn/'.length).replace(/\/+$/, '');
        const guide = GUIDES.find((g) => g.slug === slug);
        if (guide) return html(getGuideHTML(guide));
        return Response.redirect(url.origin + '/learn', 302);

      } else {
        // The product site is a single page for now, so /optionsvision,
        // /tradevision and anything else land on the root instead of 404ing.
        return Response.redirect(url.origin + '/', 301);
      }
    }

    // ===== vishnumuthiah.com — the portfolio =====
    if (path === '/privacy-policy') {
      return new Response(getPrivacyPolicyHTML(), {
        headers: { "content-type": "text/html;charset=UTF-8" },
      });

    } else if (path === '/terms-of-service') {
      return new Response(getTermsOfServiceHTML(), {
        headers: { "content-type": "text/html;charset=UTF-8" },
      });

    } else if (path === '/support') {
      return new Response(getSupportHTML(), {
        headers: { "content-type": "text/html;charset=UTF-8" },
      });

    } else if (path === '/sources-tracker') {
      return new Response(getSourcesTrackerHomepageHTML(), {
        headers: { "content-type": "text/html;charset=UTF-8" },
      });

    } else if (path === '/optionsvision') {
      // A mirror of optionsvision.app: same content, same order, same motion.
      // `app: false` is the only difference -- it skips getAppThemeStyles(), so
      // the page renders in the portfolio's light palette, and swaps the footer
      // and back-link for the portfolio's own.
      return html(getTradeVisionHTML({ app: false }));

    } else if (path === '/tradevision') {
      // Old app-name URL — permanently redirect to /optionsvision so existing
      // links (App Store listing, previously shared links) keep working.
      return Response.redirect(url.origin + '/optionsvision', 301);

    } else {
      return new Response(getHomepageHTML(), {
        headers: { "content-type": "text/html;charset=UTF-8" },
      });
    }
  },
};


// ===== SHARED STYLES (Edit once, applies everywhere) =====
function getSharedStyles() {
  return `
    <style>
      /* ===== THEME TOKENS =====
         Defaults below are the portfolio's original palette, literal for
         literal, so vishnumuthiah.com renders exactly as it always has.
         getAppThemeStyles() redefines the same names for optionsvision.app,
         which is why every rule below reads a variable and never a hex. */
      :root {
        --bg: #ffffff;
        --text: #202124;
        --text-body: #3c4043;
        --text-muted: #5f6368;
        --accent: #1a73e8;
        --accent-hover: #1557b0;
        --on-accent: #fff;
        --surface: #f8f9fa;
        --surface-alt: #e8f0fe;
        --surface-code: #f1f3f4;
        --border: #dadce0;
        --panel: #fff;
        --shadow: rgba(0,0,0,0.1);
        /* The sticky bar reads as its own surface rather than as more page, so
           it gets the tinted blue instead of the white ground. */
        --stickybar-bg: var(--surface-alt);
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
function getSupportPageStyles() {
  return `
    <style>
      body {
        background-color: #f8f9fa;
        padding: 20px;
      }
      .container {
        background-color: white;
        padding: 40px;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        max-width: 800px;
      }
      h1 {
        color: #1a73e8;
        font-size: 2em;
      }
      h2 {
        margin-top: 30px;
        font-size: 1.5em;
        border-bottom: 2px solid #1a73e8;
        padding-bottom: 10px;
      }
      h3 {
        color: #555;
        margin-top: 20px;
      }
      .back-link {
        margin-top: 30px;
        padding: 10px 20px;
        background-color: #1a73e8;
        color: white;
        border-radius: 6px;
        text-decoration: none;
      }
      .back-link:hover {
        background-color: #1557b0;
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
      .appstore-badge {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        background: #000;
        color: #fff;
        border: 1px solid #000;
        border-radius: 12px;
        padding: 10px 20px;
        text-decoration: none;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      .appstore-badge:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.22);
        text-decoration: none;
      }
      .appstore-badge__logo {
        width: 26px;
        height: 26px;
        flex: 0 0 auto;
        color: #fff;
      }
      .appstore-badge__text {
        display: flex;
        flex-direction: column;
        line-height: 1.12;
        text-align: left;
      }
      .appstore-badge__small {
        font-size: 11px;
        letter-spacing: 0.02em;
      }
      .appstore-badge__big {
        font-size: 20px;
        font-weight: 600;
      }

      ${getCarouselCSS()}
    </style>
  `;
}

// ===== OPTIONSVISION APP THEME (optionsvision.app only) =====
// Loaded after the page styles so it wins on order, and only for pages served
// on the app host. Two halves: the token block, which recolors everything that
// went through the tokenization pass, and a short list of restatements for the
// surfaces whose colors are still literal (the carousel and the CTA badge).
//
// Values are lifted from the app's own Theme.swift so the site and the app read
// as one product: launchNavy #0E1B33, wellFill #16233F, boxFill #1A263D,
// accent #6BCCF5, gold #D9AE57, and the launch screen's off-white #EBE6DA.
function getAppThemeStyles() {
  return `
    <style>
      :root {
        --bg: #0E1B33;
        --text: #EBE6DA;
        --text-body: #C7D3E6;
        --text-muted: #AABBD8;
        --accent: #6BCCF5;
        --accent-hover: #9BDDF8;
        /* Navy label on the bright accent -- the inverse of the light theme. */
        --on-accent: #0E1B33;
        --surface: #1A263D;
        --surface-alt: #16233F;
        --surface-code: #16233F;
        --border: #26364A;
        --panel: #16233F;
        --shadow: rgba(0, 0, 0, 0.45);
        /* Gold is the app's Pro accent; here it marks section chrome only, so
           it never competes with the blue that signals "this is a link". */
        --gold: #D9AE57;
        /* Held at the page ground here. The portfolio tints its sticky bar, but
           on navy that separation is unnecessary -- and inheriting the light
           theme's --surface-alt would shift this to a second, paler navy. */
        --stickybar-bg: var(--bg);
      }

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

      /* --- App Store badge: Apple's standard black badge, same as everywhere
             else. It reads as a dark shape against the navy, which is how it
             sits on Apple's own dark pages -- the white lockup carries it. An
             earlier revision recoloured this to the launch screen's off-white
             bar; that drifted from Apple's artwork, so it's back to black. --- */
      .appstore-badge:hover {
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.45);
      }
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
  '.project-card',
  '.portfolio-embed',
  '.tv-band',
  '.tv-copy > *',
];

/// The subset the script observes one-by-one. Everything inside `.tv-copy` is handled
/// separately, grouped under its heading, so it is not listed here.
const REVEAL_STANDALONE = '.project-card, .portfolio-embed, .tv-band';

function getMotionStyles() {
  const transitions = REVEAL_TARGETS.map((s) => `html.motion-ready ${s}`).join(',\n      ');
  const hidden = REVEAL_TARGETS.map((s) => `html.motion-ready ${s}:not(.is-visible)`).join(',\n      ');
  return `
    <style>
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
        transform: translateY(18px);
      }

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
      .tv-stickybar__name {
        font-weight: 700;
        /* 1.05rem -> 1.3rem: 4px up from where this started. The name is allowed to
           ellipsis and the pill is flex:none, so growing this can never squeeze the
           tap target on a narrow screen. */
        font-size: 1.3rem;
        color: var(--text);
        letter-spacing: -0.01em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
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
        .tv-stickybar__name { font-size: 1.2rem; }
        .tv-stickybar__cta {
          font-size: 0.85rem;
          padding: 8px 16px;
          min-height: 44px;
        }
      }
    </style>`;
}

/// Markup for the sticky bar. Only emitted on the two pages with a real call to
/// action; the legal and support pages deliberately have none.
function getStickyBarHTML(label, href) {
  return `    <div class="tv-stickybar" id="tvStickyBar" aria-hidden="true">
      <span class="tv-stickybar__name">OptionsVision</span>
      <a class="tv-stickybar__cta" href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>
    </div>`;
}

function getMotionScript() {
  return `
    <script>
    (function () {
      var standalone = ${JSON.stringify(REVEAL_STANDALONE)};
      var motion = document.documentElement.classList.contains('motion-ready');
      var hasIO = 'IntersectionObserver' in window;

      // --- Scroll reveal ---
      if (motion) {
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
      var heroCTA = document.querySelector('.tv-cta');
      if (bar && heroCTA) {
        // A scroll listener rather than an observer, on purpose. This is a single
        // boolean derived from one element's position, the read is rAF-throttled so
        // it costs one getBoundingClientRect per frame at most, and unlike an
        // observer it can be verified anywhere. Comparing against the current class
        // first means no style write happens on the vast majority of frames.
        var ticking = false;
        var update = function () {
          ticking = false;
          // Stick only once the hero CTA has fully passed the top edge -- never
          // while it is still below the fold on a short viewport.
          var stuck = heroCTA.getBoundingClientRect().bottom < 0;
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
    // tradevision/og-card.png is 1200x630, rasterized from og-card.pdf by
    // tools/rasterize-pdf.swift (vectors drawn at target size, not upscaled).
    meta.imageWidth ? `<meta property="og:image:width" content="${meta.imageWidth}">` : '',
    meta.imageHeight ? `<meta property="og:image:height" content="${meta.imageHeight}">` : '',
    meta.imageAlt ? `<meta property="og:image:alt" content="${meta.imageAlt}">` : '',
    meta.image ? `<meta name="twitter:card" content="summary_large_image">` : `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${social}">`,
    meta.description ? `<meta name="twitter:description" content="${meta.description}">` : '',
    meta.image ? `<meta name="twitter:image" content="${meta.image}">` : '',
    meta.imageAlt ? `<meta name="twitter:image:alt" content="${meta.imageAlt}">` : '',
    // Tints mobile browser chrome to match the navy ground.
    meta.app ? `<meta name="theme-color" content="#0E1B33">` : '',
    // Keeps unfinished pages out of search results. Draft strategy guides must not
    // be indexed under this domain before they have been edited and sourced.
    meta.noindex ? `<meta name="robots" content="noindex, nofollow">` : '',
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
    ${meta.app ? getAppThemeStyles() : ''}
    ${getMotionStyles()}
    ${getMobileStyles()}
    <script>
      // Opt in to motion before the first paint, so the reveal rules apply to the
      // initial render instead of flashing content in and then hiding it. Anything
      // that would leave content invisible is gated on this class, so a visitor
      // with JS off -- or one who has asked for reduced motion -- gets the plain,
      // fully visible page.
      if (!window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.documentElement.classList.add('motion-ready');
      }
    </script>
</head>
<body>
    ${content}
    ${getMotionScript()}
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
        .tv-coverflow .tv-carousel-arrow { display: flex; }

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
function getSourcesTrackerHomepageHTML() {
  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Sources Tracker Homepage</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Automatically track every source, citation, and link in your Google Slides presentations." />

    <style>
      body {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
        margin: 0;
        padding: 32px 24px;
        background: #ffffff;
        color: #202124;
      }

      .container {
        max-width: 900px;
        margin: 0 auto;
      }

      h1 {
        font-size: 2.5rem;
        font-weight: 600;
        margin: 24px 0 16px 0;
      }

      h2 {
        font-size: 1.5rem;
        font-weight: 600;
        margin-top: 40px;
        margin-bottom: 12px;
      }

      h3 {
        font-size: 1.2rem;
        font-weight: 600;
        margin-top: 28px;
        margin-bottom: 8px;
      }

      p {
        font-size: 1rem;
        line-height: 1.7;
        margin-bottom: 16px;
      }

      ul, ol {
        margin-left: 24px;
        margin-bottom: 16px;
      }

      li {
        margin-bottom: 6px;
      }

      a {
        color: #1a73e8;
        text-decoration: none;
        font-weight: 500;
      }

      a:hover {
        text-decoration: underline;
      }

      .back-link {
        display: inline-block;
        margin-bottom: 16px;
        font-size: 0.95rem;
      }

      .cta {
        margin-top: 48px;
        padding: 24px;
        background: none;
        border-radius: 8px;
      }
      .footer {
        margin-top: 64px;
        font-size: 0.9rem;
        opacity: 0.9;
      }
    </style>
  </head>

  <body>
    <div class="container">
      <h1>Automatically keep track of every source, citation, and link in your presentations.</h1>

      <div style="margin: 24px 0;">
        <iframe width="100%" height="480" src="https://www.youtube.com/embed/Z7QSvFDqXjM" title="Sources Tracker for Google Slides demo" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="border-radius: 8px;"></iframe>
      </div>

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
        src="https://raw.githubusercontent.com/vishnuamuthiah/vishnuamuthiah.com/refs/heads/main/sources-tracker/Screenshot%202026-01-02%20at%204.10.37%20PM.png"
        alt="Sources Tracker sidebar integrated into Google Slides"
        style="
          display: block;
          max-width: 100%;
          height: auto;
          margin: 16px 0 24px 0;
          border: 1px solid #dadce0;
        "
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

      <div class="footer">
        <p><a href="/">← Back to home</a></p>
      </div>
    </div>
  </body>
</html>
  `;
}



function getHomepageHTML() {
  return getLayout('Vishnu Muthiah - Strategy Consultant', `
    <div class="container">
      <header>
        <h1>Vishnu Muthiah</h1>
        <p class="tagline">Strategy Consultant | Builder</p>
        <div class="contact-links">
          <a href="mailto:VishnuAMuthiah@gmail.com">Email</a>
          <a href="https://www.linkedin.com/in/vishnumuthiah" target="_blank">LinkedIn</a>
        </div>
      </header>

      <section>
        <h2>About</h2>
        <div class="about">
          <p>I'm an experienced strategy consultant and technology consultant with over 9 years of post-undergraduate experience. I've recently combined my consulting experience with my hands-on product development experience to build tools that solve real problems.</p>
        </div>

        <div class="experience">
          <h3>Professional Experience</h3>
          <ul>
            <li>2022-2025 Senior Strategy Consultant, Accenture Strategy</li>
            <li>2016-2020 Microsoft Enterprise Technology Consultant, IBM</li>
          </ul>
          <h3>Educational Experience</h3>
          <ul>
            <li>2020-2022 MBA, University of Michigan Ross School of Business</li>
            <li>2012-2016 BS, University of Virginia - Majors: Systems Engineering, Economics</li>
          </ul>
        </div>
      </section>

      <section>
      <div class="project-grid">
      <!-- Professional Bio (PDF Embed) -->
        <div class="portfolio-embed">
          <h3>Professional Experience</h3>
          <p>A overview of my professional experience, key projects, and capabilities across strategy consulting, product management, and software development.</p>
          <div class="pdf-viewer-wrapper" style="padding-top: 58%;">
            <iframe
              src="https://drive.google.com/file/d/1wIy3K3nzAfCEweJIBcULe-5jm-aiJ8we/preview"
              title="Professional Bio PDF"
              loading="lazy"
              allow="autoplay"
              allowfullscreen>
            </iframe>
          </div>
          <div class="pdf-fallback" id="pdf-fallback-bio">
            <p>Unable to preview the PDF in your browser.</p>
            <a class="pdf-download-btn" href="https://raw.githubusercontent.com/vishnuamuthiah/vishnuamuthiah.com/main/Professional%20Bio%20-%20Vishnu%20Muthiah.pdf" target="_blank" rel="noopener noreferrer">Download Portfolio PDF</a>
          </div>
          <div class="tags" style="margin-top: 15px;">
          </div>
          <div class="project-links">
            <a href="https://raw.githubusercontent.com/vishnuamuthiah/vishnuamuthiah.com/main/Professional%20Bio%20-%20Vishnu%20Muthiah.pdf" target="_blank" rel="noopener noreferrer">Download PDF →</a>
          </div>
        </div>

        <!-- OptionsVision -->
        <div class="project-card">
          <h3><a href="/optionsvision" target="_blank" rel="noopener noreferrer">OptionsVision</a></h3>
          <p>Take a screenshot of your Robinhood order and watch it become an interactive P&amp;L chart. Model different scenarios by adjusting your days to expiration and your implied volatility. Then analyze your Greeks and break-evens, all privately on your device.</p>

          <div style="margin: 8px 0 0;">
            ${getDemoVideosHTML()}
          </div>

          <div class="project-links">
            <a href="/optionsvision">Learn More →</a>
            <a href="https://optionsvision.app" target="_blank" rel="noopener noreferrer">Visit optionsvision.app →</a>
          </div>
        </div>

        <!-- Portfolio Deck (PDF Embed) -->
        <div class="portfolio-embed">
          <h3>Consulting Case Interview Mental Model</h3>
          <p>A comprehensive mental model for developing the framework to tackle any consulting case interview.</p>
          <div class="pdf-viewer-wrapper" style="padding-top: 58%;">
            <iframe
              src="https://drive.google.com/file/d/1FxHmnqk2j1rpzcNAYWlfcmt7LVCOY60r/preview"
              title="Case Interview Mental Model PDF"
              loading="lazy"
              allow="autoplay"
              allowfullscreen>
            </iframe>
          </div>
          <div class="pdf-fallback" id="pdf-fallback">
            <p>Unable to preview the PDF in your browser.</p>
            <a class="pdf-download-btn" href="https://raw.githubusercontent.com/vishnuamuthiah/vishnuamuthiah.com/main/sources-tracker/Case%20Interview%20Mental%20Model.pdf" target="_blank" rel="noopener noreferrer">Download Portfolio PDF</a>
          </div>
          <div class="tags" style="margin-top: 15px;">
          </div>
          <div class="project-links">
            <a href="https://raw.githubusercontent.com/vishnuamuthiah/vishnuamuthiah.com/main/sources-tracker/Case%20Interview%20Mental%20Model.pdf" target="_blank" rel="noopener noreferrer">Download PDF →</a>
          </div>
        </div>

        <!-- Sources Tracker -->
        <div class="project-card">
          <h3><a href="/sources-tracker" target="_blank" rel="noopener noreferrer">Sources Tracker for Google Slides™</a></h3>
          <p>A Google Workspace add-on that automatically detects and organizes citations, links, and references in presentations. Features include automatic source detection, threaded comments, cross-slide tracking, and exportable summaries.</p>

          <div style="margin: 20px 0;">
            <iframe width="100%" height="315" src="https://www.youtube.com/embed/Z7QSvFDqXjM" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="border-radius: 8px;"></iframe>
          </div>

          <div class="tags">
          </div>
          <div class="project-links">
            <a href="/sources-tracker">Learn More →</a>
            <a href="https://workspace.google.com/marketplace/app/sources_tracker_for_google_slides/979571123439" target="_blank">Install→</a>
            <a href="https://vishnumuthiah.com/support" target="_blank">Support →</a>
          </div>
        </div>
        <div class="project-card" style="opacity: 0.6;">
          <h3>More Projects Coming Soon</h3>
          <p>More to come!</p>
          <div class="tags">
            <span class="tag">In Development</span>
          </div>
        </div>
      </div>
    </section>

      <section>
        <h2>Contact</h2>
        <p style="font-size: 18px; color: #3c4043;">
          <strong>Email:</strong> <a href="mailto:VishnuAMuthiah@gmail.com">VishnuAMuthiah@gmail.com</a><br>
        </p>
      </section>

      <footer>
        <p>&copy; 2025 Vishnu Muthiah. All rights reserved.</p>
        <p style="margin-top: 10px;">
          <a href="/privacy-policy">Privacy Policy</a> |
          <a href="/terms-of-service">Terms of Service</a>
        </p>
      </footer>
    </div>

<script>
      // Auto-retry Google Docs viewer iframes
      document.querySelectorAll('.pdf-viewer-wrapper iframe').forEach(function(iframe) {
        var attempts = 0;
        var maxAttempts = 5;
        var src = iframe.src;

        iframe.addEventListener('load', function() {
          try {
            var doc = iframe.contentDocument || iframe.contentWindow.document;
            if (doc && doc.body && doc.body.innerHTML.length < 100) {
              if (attempts < maxAttempts) {
                attempts++;
                setTimeout(function() { iframe.src = src; }, 1500 * attempts);
              }
            }
          } catch(e) {
            // Cross-origin means Google loaded content — success
          }
        });

        iframe.addEventListener('error', function() {
          if (attempts < maxAttempts) {
            attempts++;
            setTimeout(function() { iframe.src = src; }, 1500 * attempts);
          }
        });
      });
    </script>
    ${getDemoVideosScript()}
  `, `<style>${getCarouselCSS()}</style>`);
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
        max-width: 880px;
        margin: 0 auto;
      }
      .tv-cf-stage {
        position: relative;
        height: 702px;
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
        transform: translateX(calc(-50% - 235px)) scale(0.8);
        opacity: 0.6;
        filter: grayscale(0.9) brightness(0.75);
        z-index: 2;
        cursor: pointer;
      }
      .tv-cf-item.is-next {
        transform: translateX(calc(-50% + 235px)) scale(0.8);
        opacity: 0.6;
        filter: grayscale(0.9) brightness(0.75);
        z-index: 2;
        cursor: pointer;
      }
      /* Neighbors: whole card is a click target to bring it forward (no play/scrub) */
      .tv-cf-item:not(.is-active) .tv-short-frame {
        pointer-events: none;
      }
      .tv-coverflow .tv-carousel-arrow {
        z-index: 4;
        display: none; /* desktop: neighbor videos are visible + clickable, no arrows needed */
      }
      .tv-cf-item .tv-carousel-caption {
        max-width: 365px;
        margin-left: auto;
        margin-right: auto;
      }
      @media (max-width: 760px) {
        /* Tighter fanning on narrow screens */
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
  // Served from raw.githubusercontent.com at 751x1560 (2x the 360px carousel viewport).
  return `      <!-- Demo Walkthrough: seven intro slides, shared by optionsvision.app and the portfolio case study. -->
      <div class="portfolio-embed tv-walkthrough">
        <h3>Demo Walkthrough</h3>
        <div class="tv-carousel tv-carousel--images" id="walkthroughCarousel">
          <button class="tv-carousel-arrow tv-carousel-prev" type="button" aria-label="Previous slide">&#8249;</button>
          <div class="tv-carousel-viewport">
            <div class="tv-carousel-track">
              <div class="tv-carousel-slide">
                <img class="tv-carousel-img" src="https://raw.githubusercontent.com/vishnuamuthiah/vishnuamuthiah.com/main/tradevision/walkthrough/1.png" alt="OptionsVision walkthrough slide 1" loading="lazy" />
              </div>
              <div class="tv-carousel-slide">
                <img class="tv-carousel-img" src="https://raw.githubusercontent.com/vishnuamuthiah/vishnuamuthiah.com/main/tradevision/walkthrough/2.png" alt="OptionsVision walkthrough slide 2" loading="lazy" />
              </div>
              <div class="tv-carousel-slide">
                <img class="tv-carousel-img" src="https://raw.githubusercontent.com/vishnuamuthiah/vishnuamuthiah.com/main/tradevision/walkthrough/3.png" alt="OptionsVision walkthrough slide 3" loading="lazy" />
              </div>
              <div class="tv-carousel-slide">
                <img class="tv-carousel-img" src="https://raw.githubusercontent.com/vishnuamuthiah/vishnuamuthiah.com/main/tradevision/walkthrough/4.png" alt="OptionsVision walkthrough slide 4" loading="lazy" />
              </div>
              <div class="tv-carousel-slide">
                <img class="tv-carousel-img" src="https://raw.githubusercontent.com/vishnuamuthiah/vishnuamuthiah.com/main/tradevision/walkthrough/5.png" alt="OptionsVision walkthrough slide 5" loading="lazy" />
              </div>
              <div class="tv-carousel-slide">
                <img class="tv-carousel-img" src="https://raw.githubusercontent.com/vishnuamuthiah/vishnuamuthiah.com/main/tradevision/walkthrough/6.png" alt="OptionsVision walkthrough slide 6" loading="lazy" />
              </div>
              <div class="tv-carousel-slide">
                <img class="tv-carousel-img" src="https://raw.githubusercontent.com/vishnuamuthiah/vishnuamuthiah.com/main/tradevision/walkthrough/7.png" alt="OptionsVision walkthrough slide 7" loading="lazy" />
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

// `app: true` renders this as the standalone product site at optionsvision.app
// (navy theme, no portfolio chrome). Called with no options it is the light
// page on vishnumuthiah.com.
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
    app: true,
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
    app: true,
  });
}

// ===== PORTFOLIO CASE STUDY (vishnumuthiah.com/optionsvision) =====
// The product pitch lives on optionsvision.app; this page is the engineering
// write-up for the same project and stays in the portfolio's light theme.
//
// Every figure below is measured, and the framing is deliberate: the scrub
// numbers are compared against a reconstructed naive implementation, not a
// slower version that ever shipped, because the isolation landed inside the
// original feature commits. Don't reword these into "optimized from X".
function getOptionsVisionCaseStudyHTML() {
  return getLayout('OptionsVision — Case Study | Vishnu Muthiah', `
${getStickyBarHTML('Visit optionsvision.app', 'https://optionsvision.app')}
    <div class="container">
      <a href="/" class="back-link">← Back to Home</a>

      <h1>OptionsVision</h1>
      <p class="tagline">An iOS app that turns a screenshot of an options trade into an interactive payoff chart. Swift and SwiftUI, on-device OCR, an options pricing engine written from scratch, and a weekly market-data pipeline.</p>

      <div class="tv-cta">
        <a class="appstore-badge" href="https://optionsvision.app" target="_blank" rel="noopener noreferrer" aria-label="Visit the OptionsVision product site">
          <span class="appstore-badge__text">
            <span class="appstore-badge__small">Visit the product site</span>
            <span class="appstore-badge__big">optionsvision.app</span>
          </span>
        </a>
      </div>

      ${getDemoVideosHTML()}

      ${getWalkthroughCarouselHTML()}

      <section class="tv-copy">
        <h2>The problem</h2>
        <p>Brokerages show you an options payoff at expiration and nothing else. The questions that actually matter before then — what this position is worth if the stock drops 5% with three days left, whether the option is cheap or expensive, where the trade breaks even if volatility moves — need a model, and retail tools either don't answer them or bury the answer behind a subscription and a live quote feed.</p>
        <p>OptionsVision answers them on-device, offline, from a screenshot.</p>

        <h2>Engineering notes</h2>

        <h3>Import by screenshot, parsed on-device</h3>
        <p>Apple's Vision text recognition reads a Robinhood order ticket and reconstructs a structured trade: strategy, strikes, expiration, spot price, per-leg premiums. Multi-leg positions combine two screenshots — the order ticket plus the per-leg premium view — which is what makes it possible to recover true per-leg implied volatilities and the separate expirations a calendar spread needs. No image or trade leaves the device.</p>

        <h3>A pricing engine, not a quote feed</h3>
        <p>Implied volatility is solved per leg from the entry price by bisection, so every leg reprices exactly at its own strike and days-to-expiration rather than sharing one blended number. Greeks, break-evens and probability of profit are all computed locally, which is what lets the whole chart stay interactive with no network in the loop.</p>

        <h3>Why Black–Scholes holds up here</h3>
        <p>The alternative is a binomial tree, which handles American early exercise correctly. I benchmarked one to find out what that costs: a single Black–Scholes price runs 18 ns against 19.5 µs for a 200-step American CRR tree, roughly a thousandfold. Across the 241-point break-even scan the chart depends on, that is 8.6 µs versus 11.8 ms — 71% of a 60 fps frame budget, for a scan that has to finish between frames while the user drags a slider.</p>
        <p>What Black–Scholes gives up is the early-exercise premium: about 1.3% to 3% on in-the-money puts and essentially nothing on calls. So the tree costs three orders of magnitude more compute to correct ITM puts by a couple of percent. Worth being precise about the limit — at 100 steps a tree is 19% of a frame, which is not impossible, just enough to eat the headroom that interactive scrubbing runs on.</p>

        <h3>Keeping the scrub inside a frame</h3>
        <p>The expensive path is the break-even scan: 241 price points evaluated against every leg, every time the user moves the days-to-expiration or volatility slider. It costs 1.4 ms for a single-leg call and 5.8 ms for a four-leg iron condor — a third of a frame on its own.</p>
        <p>Isolating the views that depend on it and passing anchor-independent break-evens down precomputed keeps that scan out of the per-tick path entirely, leaving 0.09 ms to 0.17 ms per tick. Measured against a reconstructed naive implementation that rescans on every tick — what an unisolated SwiftUI body does by default — that is a 33–35× difference, or 35% of a frame budget down to 1%. Release build, iPhone 17 simulator; a physical device would be slower in absolute terms, which makes the frame-budget argument stronger rather than weaker.</p>

        <h3>Offline-first market data</h3>
        <p>Tickers, earnings dates, dividends and 52-week implied-volatility history come from a separate Python pipeline that pulls from Cboe and treasury.gov and publishes versioned data files. The app fetches them in the background about once a week and works completely offline in between. Refreshing the data never requires shipping an app update.</p>

        <h3>Ported to Android by porting the math first</h3>
        <p>The pricing core is a standalone Kotlin module validated against a golden JSON fixture generated from the iOS implementation — identical inputs asserted to identical outputs, case by case, before any Android UI existed. Getting the numerical parity settled first means later UI work can't quietly introduce a pricing discrepancy between the two platforms.</p>

        <h3>Analytics without a third-party SDK</h3>
        <p>Feature usage reports to a Cloudflare Worker I run myself, backed by Analytics Engine. It records which features get used and nothing else — no trades, symbols, strikes, amounts or screenshots — against a random install identifier that is erased with the app, and it can be turned off in-app.</p>

        <h2>Stack</h2>
        <p>Swift · SwiftUI · Vision · StoreKit 2 · XCTest — Kotlin (pricing core ported and parity-tested, Compose UI in progress) — Python data pipeline — Cloudflare Workers, R2 and Analytics Engine</p>
      </section>

      <footer>
        <p>&copy; 2026 Vishnu Muthiah. All rights reserved.</p>
        <p style="margin-top: 10px;">
          <a href="/">Home</a> |
          <a href="https://optionsvision.app">OptionsVision</a> |
          <a href="/privacy-policy">Privacy Policy</a> |
          <a href="/terms-of-service">Terms of Service</a>
        </p>
      </footer>
    </div>

    ${getDemoVideosScript()}
  `, getTradeVisionPageStyles(), {
    description: 'Case study: building OptionsVision — on-device screenshot OCR, an options pricing engine, and keeping a 241-point break-even scan inside a 60 fps frame budget.',
    url: 'https://vishnumuthiah.com/optionsvision',
  });
}

// ===== Learning Library =====
// Five strategy guides, each its own page at /learn/<slug> on optionsvision.app,
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
function getGuidesCarouselHTML(app = false) {
  const live = publishedGuides();
  if (!live.length) return '';
  // The /learn routes exist on the product host only, so the portfolio mirror
  // links out to them absolutely rather than at paths it does not serve.
  const base = app ? '/learn/' : 'https://' + APP_HOST + '/learn/';
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

/// The /learn index. Lists published guides; says so plainly when there are none.
function getLearningLibraryHTML() {
  const live = publishedGuides();
  const list = live.length
    ? live.map((g) => `        <a class="tv-guide-row" href="/learn/${g.slug}">
          <span class="tv-guide-row__title">${escapeHTML(g.title)}</span>
          <span class="tv-guide-row__dek">${escapeHTML(g.dek)}</span>
        </a>`).join('\n')
    : `        <p class="tv-guides-intro">The first guides are being written. Check back shortly.</p>`;

  return getLayout('Learning Library — OptionsVision', `
${getStickyBarHTML('Get the App', 'https://apps.apple.com/app/id6786063635')}
    <div class="container">
      <h1>Learning Library</h1>
      <p class="tagline">Plain-English guides to the options strategies OptionsVision charts. Educational only &mdash; none of this is financial advice or a recommendation to trade.</p>
      <div class="tv-guide-list">
${list}
      </div>
    </div>
  `, getTradeVisionPageStyles(), {
    description: 'Plain-English guides to the options strategies OptionsVision charts.',
    url: 'https://' + APP_HOST + '/learn',
    app: true,
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
      <a href="/learn" class="back-link">&larr; Learning Library</a>
      <h1>${escapeHTML(guide.title)}</h1>
      ${guide.dek ? `<p class="tagline">${escapeHTML(guide.dek)}</p>` : ''}
${body}
      <p class="tv-disclaimer">${escapeHTML(LEGAL_FINE_PRINT)}</p>
    </div>
  `, getTradeVisionPageStyles(), {
    description: guide.dek || (guide.title + ' — a plain-English strategy guide from OptionsVision.'),
    url: 'https://' + APP_HOST + '/learn/' + guide.slug,
    app: true,
    noindex: draft,
  });
}

function getTradeVisionHTML({ app = false } = {}) {
  return getLayout('OptionsVision — Options Payoff Charts from a Robinhood Screenshot', `
${getStickyBarHTML('Get the App', 'https://apps.apple.com/app/id6786063635')}
    <div class="container">
      ${app ? '' : '<a href="/" class="back-link">← Back to Home</a>'}

      <h1>OptionsVision</h1>
      <p class="tagline">Take a screenshot from Robinhood and watch it become an interactive P&amp;L chart. Model different scenarios by adjusting your days to expiration and your implied volatility. Then analyze your Greeks and break-evens, all privately on your device.</p>

      <div class="tv-cta">
        <a class="appstore-badge" href="https://apps.apple.com/app/id6786063635" target="_blank" rel="noopener noreferrer" aria-label="Download OptionsVision on the App Store">
          <svg class="appstore-badge__logo" viewBox="0 0 384 512" aria-hidden="true"><path fill="currentColor" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
          <span class="appstore-badge__text">
            <span class="appstore-badge__small">Download on the</span>
            <span class="appstore-badge__big">App Store</span>
          </span>
        </a>
      </div>

      ${getDemoVideosHTML()}

      <section class="tv-copy">
        <p>OptionsVision turns any options trade into an interactive payoff chart so you can trade smarter.</p>

        <p>Brokerages like Robinhood only show you the payoff at expiration. What's missing is how to value your position before expiration and how to determine whether the option is cheap or expensive. OptionsVision solves these problems in a simple, easy to use UI.</p>

        <p>Wondering what your covered call actually looks like if the stock drops 5% with 3 days to expiration remaining? Where your calendar spread breaks even with a change in volatility? Your theta decay if you sold your option right after ex-dividend date? OptionsVision answers these questions with an interactive and accessible payoff chart.</p>

        <h2>How It Works: Screenshot to Interactive Chart in Seconds</h2>

      ${getWalkthroughCarouselHTML()}

        <h3>Import in Seconds</h3>
        <p>Take a screenshot of your Robinhood order ticket and OptionsVision reads it with Apple's on-device text recognition and automatically pre-populates the strategy, strikes, expiration, spot price, and premiums. Multi-leg trades import from two screenshots (order ticket + per-leg premium) to capture real per-leg IVs as well as multiple expiration dates for calendar spreads. Prefer to skip the screenshot? Enter any trade by hand in a few taps.</p>

        <h3>See the Whole Trade</h3>
        <p>An interactive profit-and-loss chart shows your position across the full price range: break-evens marked on the curve, max profit and max loss, and distance-to-break-even at a glance. Scrub any price to see your exact expected P&amp;L.</p>

        <h3>Watch Time and Volatility Work</h3>
        <p>Adjust days-to-expiration and IV to watch theta decay reshape your position in real time. Or flip to the at-expiration view for the standard payoff chart. As each dividend's ex-date passes, it drops out of the pricing, so the chart stays accurate.</p>

        <h3>Real Analytics, Not Approximations</h3>
        <ul>
          <li>Black-Scholes pricing with implied volatility solved from your actual per-leg entry premiums</li>
          <li>Live Greeks: Delta, Gamma, Theta, and Vega, per share and for the whole position</li>
          <li>Risk-free rates matched to your expiration from the daily U.S. Treasury yield curve</li>
          <li>Upcoming earnings dates and projected ex-dividends for over 5,000 optionable tickers, refreshed weekly</li>
          <li>Override any assumption including rate, dividend yield, IV</li>
        </ul>

        <h3>Supports 31 Options Strategies</h3>
        <p>OptionsVision is built to handle each option strategy with context-aware inputs and a clear explanation of how the trade makes and loses money. Supported strategies include:</p>
        <ul>
          <li><strong>Single Leg Options:</strong> Long calls, long puts, covered calls, and cash-secured puts</li>
          <li><strong>2-Leg Vertical Spreads:</strong> Call debit spreads, call credit spreads, put debit spreads, and put credit spreads</li>
          <li><strong>Long Straddles and Strangles</strong></li>
          <li><strong>Calendar Spreads:</strong> Long call calendar spreads, long put calendar spreads, and short put calendar spreads</li>
          <li><strong>Diagonals:</strong> Long call diagonal, long put diagonal, and short put diagonal</li>
          <li><strong>4-Leg Condors:</strong> Long call condor, short call condor, long put condor, short put condor, long iron condor, and short iron condor</li>
          <li><strong>4-Leg Butterflies:</strong> Long call butterfly, short call butterfly, long put butterfly, short put butterfly, long iron butterfly, and short iron butterfly</li>
          <li><strong>Unbalanced Ratios:</strong> Put front ratio, call back ratio, and put back ratio</li>
        </ul>

        <h3>Private by Design</h3>
        <p>No account necessary and no ads. Your screenshots are processed entirely on your device, and your trades never leave it. The app works completely offline with tickers, earnings, IV history, and dividend data refreshing in the background each week.</p>

        <h3>Built for Learning</h3>
        <p>Sharpen how you read a trade and grow the number of options strategies you can confidently use.</p>

        <p class="tv-disclaimer">OptionsVision is an educational tool and is not investment advice, not a broker, and never touches your brokerage account. Figures are theoretical model estimates, not live quotes. Options involve substantial risk and are not suitable for every investor.</p>
      </section>

${getGuidesCarouselHTML(app)}

      <footer>
        <p>&copy; 2026 Vishnu Muthiah. All rights reserved.</p>
        <p style="margin-top: 10px;">
          ${app
            ? `<a href="/support">Application Support</a> |
          <a href="/privacy-policy">Privacy Policy</a> |
          <a href="/terms-of-service">Terms of Use</a> |
          <a href="/disclaimer">Disclaimer</a> |
          <a href="https://vishnumuthiah.com/">About the Developer</a>`
            // Same links on the mirror, pointed at the product host. The
            // portfolio's own /support, /privacy-policy and /terms-of-service
            // document the Sources Tracker Slides add-on, so linking them from
            // a page about OptionsVision would show a visitor the wrong policy.
            : `<a href="/">Home</a> |
          <a href="https://${APP_HOST}/support">Application Support</a> |
          <a href="https://${APP_HOST}/privacy-policy">Privacy Policy</a> |
          <a href="https://${APP_HOST}/terms-of-service">Terms of Use</a> |
          <a href="https://${APP_HOST}/disclaimer">Disclaimer</a>`}
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
    image: 'https://raw.githubusercontent.com/vishnuamuthiah/vishnuamuthiah.com/main/tradevision/og-card.png',
    imageWidth: 1200,
    imageHeight: 630,
    imageAlt: 'OptionsVision — an options payoff curve rising across a navy background',
    // The product domain is the canonical home for this content; the portfolio
    // copy points here too (step 4 turns that one into a case study).
    url: app ? 'https://optionsvision.app/' : 'https://vishnumuthiah.com/optionsvision',
    app,
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

// Shared by both sites; `app: true` renders it in the navy product theme.
function getPrivacyPolicyHTML({ app = false } = {}) {
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

// Shared by both sites; `app: true` renders it in the navy product theme.
function getTermsOfServiceHTML({ app = false } = {}) {
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
