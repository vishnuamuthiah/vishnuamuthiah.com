export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Route handling
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

    } else if (path === '/tradevision') {
      return new Response(getTradeVisionHTML(), {
        headers: { "content-type": "text/html;charset=UTF-8" },
      });

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
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        line-height: 1.6;
        color: #202124;
        background: #ffffff;
      }
      .container {
        max-width: 900px;
        margin: 0 auto;
        padding: 60px 20px;
      }
      header {
        margin-bottom: 60px;
        border-bottom: 3px solid #1a73e8;
        padding-bottom: 30px;
      }
      h1 {
        font-size: 48px;
        margin-bottom: 10px;
        color: #202124;
      }
      h2 {
        font-size: 32px;
        margin-bottom: 20px;
        color: #202124;
      }
      h3 {
        font-size: 20px;
        margin-bottom: 15px;
        color: #202124;
      }
      p, li {
        margin-bottom: 10px;
        color: #3c4043;
      }
      ul {
        margin-left: 20px;
        margin-bottom: 15px;
      }
      a {
        color: #1a73e8;
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
      strong {
        color: #202124;
      }
      code {
        background: #f1f3f4;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 14px;
      }
      .tagline {
        font-size: 20px;
        color: #5f6368;
        margin-bottom: 20px;
      }
      .contact-links {
        margin-top: 20px;
      }
      .contact-links a {
        margin-right: 20px;
      }
      section {
        margin-bottom: 60px;
      }
      .about {
        font-size: 18px;
        line-height: 1.8;
        color: #3c4043;
      }
      .project-grid {
        display: grid;
        gap: 30px;
        margin-top: 30px;
      }
      .project-card {
        border: 1px solid #dadce0;
        border-radius: 8px;
        padding: 30px;
        background: #f8f9fa;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .project-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }
      .project-card h3 {
        font-size: 24px;
        margin-bottom: 10px;
        color: #1a73e8;
      }
      .project-card p {
        color: #5f6368;
        margin-bottom: 15px;
      }
      .project-card .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 15px;
      }
      .tag {
        background: #e8f0fe;
        color: #1a73e8;
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
        background: #f8f9fa;
        padding: 30px;
        border-radius: 8px;
        margin-top: 20px;
      }
      .experience ul {
        list-style: none;
        padding-left: 0;
      }
      .experience li {
        padding: 8px 0;
      }
      .experience li:before {
        content: "→ ";
        color: #1a73e8;
        font-weight: bold;
      }
      .back-link {
        display: inline-block;
        margin-bottom: 30px;
      }
      .updated {
        color: #5f6368;
        font-size: 14px;
        margin-bottom: 30px;
      }
      .contact-info {
        background: #e8f0fe;
        padding: 20px;
        border-radius: 8px;
        margin: 20px 0;
      }
      .contact-info strong {
        color: #1a73e8;
      }
      footer {
        margin-top: 80px;
        padding-top: 30px;
        border-top: 1px solid #dadce0;
        color: #5f6368;
        font-size: 14px;
        text-align: center;
      }

      /* ===== PDF Portfolio Embed ===== */
      .portfolio-embed {
        border: 1px solid #dadce0;
        border-radius: 8px;
        padding: 30px;
        background: #f8f9fa;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .portfolio-embed:hover {
        transform: translateY(-4px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }
      .portfolio-embed h3 {
        font-size: 24px;
        margin-bottom: 10px;
        color: #1a73e8;
      }
      .portfolio-embed p {
        color: #5f6368;
        margin-bottom: 15px;
      }
      .portfolio-embed .pdf-viewer-wrapper {
        position: relative;
        width: 100%;
        padding-top: 75%; /* 4:3 aspect ratio */
        margin: 15px 0;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid #dadce0;
        background: #fff;
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
        background: #fff;
        border-radius: 8px;
        border: 1px solid #dadce0;
        margin: 15px 0;
      }
      .portfolio-embed .pdf-fallback p {
        margin-bottom: 15px;
        color: #5f6368;
      }
      .portfolio-embed .pdf-download-btn {
        display: inline-block;
        padding: 10px 24px;
        background: #1a73e8;
        color: #fff;
        border-radius: 6px;
        font-weight: 500;
        text-decoration: none;
        transition: background 0.2s;
      }
      .portfolio-embed .pdf-download-btn:hover {
        background: #1557b0;
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
        color: #1a73e8;
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
        margin-top: 4px;
        padding-top: 12px;
        padding-bottom: 10px;
      }
      .tv-walkthrough h3 {
        margin-top: 0;
        margin-bottom: 6px;
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

// ===== LAYOUT WRAPPER =====
function getLayout(title, content, additionalStyles = '', meta = {}) {
  // Optional SEO / social tags — only emitted when a value is supplied, so
  // pages that don't pass `meta` render exactly as before.
  const metaTags = [
    meta.description ? `<meta name="description" content="${meta.description}">` : '',
    meta.url ? `<link rel="canonical" href="${meta.url}">` : '',
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${title}">`,
    meta.description ? `<meta property="og:description" content="${meta.description}">` : '',
    meta.url ? `<meta property="og:url" content="${meta.url}">` : '',
    meta.image ? `<meta property="og:image" content="${meta.image}">` : '',
    meta.image ? `<meta name="twitter:card" content="summary_large_image">` : `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${title}">`,
    meta.description ? `<meta name="twitter:description" content="${meta.description}">` : '',
    meta.image ? `<meta name="twitter:image" content="${meta.image}">` : '',
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
</head>
<body>
    ${content}
</body>
</html>`;
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

        <!-- TradeVision -->
        <div class="project-card">
          <h3><a href="/tradevision" target="_blank" rel="noopener noreferrer">TradeVision Edge</a></h3>
          <p>Take a screenshot of your Robinhood order and watch it become an interactive P&amp;L chart. Model different scenarios by adjusting your days to expiration and your implied volatility. Then analyze your Greeks and break-evens, all privately on your device.</p>

          <div style="margin: 8px 0 0;">
            ${getDemoVideosHTML()}
          </div>

          <div class="project-links">
            <a href="/tradevision">Learn More →</a>
          </div>
        </div>

        <!-- Portfolio Deck (PDF Embed) -->
        <div class="portfolio-embed">
          <h3>Consulting Case Interview Mental Model</h3>
          <p>A comprehensive mental model for developing the framework to tackle any consulting case interview.</p>
          <div class="pdf-viewer-wrapper">
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
      /* Image-carousel variant (app screenshots, no fixed 9:16 frame) */
      .tv-carousel--images .tv-carousel-viewport {
        max-width: 360px;
      }
      .tv-carousel-img {
        display: block;
        width: 100%;
        height: auto;
        border-radius: 12px;
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

function getDemoVideosHTML() {
  return `      <!-- Demo Videos: three R2-hosted MP4s (videos.vishnumuthiah.com/v2/) in a coverflow. -->
      <!-- One active/centered; neighbors sit behind, scaled + grayed. Click a neighbor to bring it forward. -->
      <section class="tv-band">
        <h3 class="tv-band-title">Demo Videos</h3>
        <div class="tv-coverflow" id="demoCoverflow">
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

          function pauseAll() {
            carousel.querySelectorAll('video').forEach(function (v) {
              try { v.pause(); } catch (e) {}
            });
          }

          function go(i) {
            pauseAll();
            index = (i + count) % count;
            track.style.transform = 'translateX(-' + (index * 100) + '%)';
            dots.forEach(function (d, di) { d.classList.toggle('active', di === index); });
          }

          if (prev) prev.addEventListener('click', function () { go(index - 1); });
          if (next) next.addEventListener('click', function () { go(index + 1); });
          dots.forEach(function (d, di) {
            d.addEventListener('click', function () { go(di); });
          });

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
        document.querySelectorAll('.tv-short-frame').forEach(function (frame) {
          var v = frame.querySelector('video');
          var ov = frame.querySelector('.tv-play-overlay');
          if (!v || !ov) return;
          ov.addEventListener('click', function () { v.play(); });
          v.addEventListener('play', function () { ov.classList.add('hidden'); });
          v.addEventListener('pause', function () { ov.classList.remove('hidden'); });
          v.addEventListener('ended', function () { ov.classList.remove('hidden'); });
        });
      })();
    </script>`;
}

function getTradeVisionHTML() {
  return getLayout('TradeVision Edge — Options Payoff Charts from a Robinhood Screenshot', `
    <div class="container">
      <a href="/" class="back-link">← Back to Home</a>

      <h1>TradeVision Edge</h1>
      <p class="tagline">Take a screenshot from Robinhood and watch it become an interactive P&amp;L chart. Model different scenarios by adjusting your days to expiration and your implied volatility. Then analyze your Greeks and break-evens, all privately on your device.</p>

      <div class="tv-cta">
        <a class="appstore-badge" href="https://apps.apple.com/app/id6786063635" target="_blank" rel="noopener noreferrer" aria-label="Download TradeVision Edge on the App Store">
          <svg class="appstore-badge__logo" viewBox="0 0 384 512" aria-hidden="true"><path fill="currentColor" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
          <span class="appstore-badge__text">
            <span class="appstore-badge__small">Download on the</span>
            <span class="appstore-badge__big">App Store</span>
          </span>
        </a>
      </div>

      ${getDemoVideosHTML()}

      <section class="tv-copy">
        <p>TradeVision Edge turns any options trade into an interactive payoff chart so you can trade smarter.</p>

        <p>Brokerages like Robinhood only show you the payoff at expiration. What's missing is how to value your position before expiration and how to determine whether the option is cheap or expensive. TradeVision Edge solves these problems in a simple, easy to use UI.</p>

        <p>Wondering what your covered call actually looks like if the stock drops 5% with 3 days to expiration remaining? Where your calendar spread breaks even with a change in volatility? Your theta decay if you sold your option right after ex-dividend date? TradeVision Edge answers these questions with an interactive and accessible payoff chart.</p>

        <h2>How It Works: Screenshot to Interactive Chart in Seconds</h2>

      <!-- Demo Walkthrough carousel: moved to the top of How It Works -->
      <div class="portfolio-embed tv-walkthrough">
        <h3>Demo Walkthrough</h3>
        <div class="tv-carousel tv-carousel--images" id="walkthroughCarousel">
          <button class="tv-carousel-arrow tv-carousel-prev" type="button" aria-label="Previous slide">&#8249;</button>
          <div class="tv-carousel-viewport">
            <div class="tv-carousel-track">
              <div class="tv-carousel-slide">
                <img class="tv-carousel-img" src="https://raw.githubusercontent.com/vishnuamuthiah/vishnuamuthiah.com/main/tradevision/walkthrough/1.png" alt="TradeVision Edge walkthrough slide 1" loading="lazy" />
              </div>
              <div class="tv-carousel-slide">
                <img class="tv-carousel-img" src="https://raw.githubusercontent.com/vishnuamuthiah/vishnuamuthiah.com/main/tradevision/walkthrough/2.png" alt="TradeVision Edge walkthrough slide 2" loading="lazy" />
              </div>
              <div class="tv-carousel-slide">
                <img class="tv-carousel-img" src="https://raw.githubusercontent.com/vishnuamuthiah/vishnuamuthiah.com/main/tradevision/walkthrough/3.png" alt="TradeVision Edge walkthrough slide 3" loading="lazy" />
              </div>
              <div class="tv-carousel-slide">
                <img class="tv-carousel-img" src="https://raw.githubusercontent.com/vishnuamuthiah/vishnuamuthiah.com/main/tradevision/walkthrough/4.png" alt="TradeVision Edge walkthrough slide 4" loading="lazy" />
              </div>
              <div class="tv-carousel-slide">
                <img class="tv-carousel-img" src="https://raw.githubusercontent.com/vishnuamuthiah/vishnuamuthiah.com/main/tradevision/walkthrough/5.png" alt="TradeVision Edge walkthrough slide 5" loading="lazy" />
              </div>
              <div class="tv-carousel-slide">
                <img class="tv-carousel-img" src="https://raw.githubusercontent.com/vishnuamuthiah/vishnuamuthiah.com/main/tradevision/walkthrough/6.png" alt="TradeVision Edge walkthrough slide 6" loading="lazy" />
              </div>
              <div class="tv-carousel-slide">
                <img class="tv-carousel-img" src="https://raw.githubusercontent.com/vishnuamuthiah/vishnuamuthiah.com/main/tradevision/walkthrough/7.png" alt="TradeVision Edge walkthrough slide 7" loading="lazy" />
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

        <h3>Import in Seconds</h3>
        <p>Take a screenshot of your Robinhood order ticket and TradeVision Edge reads it with Apple's on-device text recognition and automatically pre-populates the strategy, strikes, expiration, spot price, and premiums. Multi-leg trades import from two screenshots (order ticket + per-leg premium) to capture real per-leg IVs as well as multiple expiration dates for calendar spreads. Prefer to skip the screenshot? Enter any trade by hand in a few taps.</p>

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

        <h3>Supports 28 Options Strategies</h3>
        <p>TradeVision Edge is built to handle each option strategy with context-aware inputs and a clear explanation of how the trade makes and loses money. Supported strategies include:</p>
        <ul>
          <li><strong>Single Leg Options:</strong> Long calls, long puts, covered calls, and cash-secured puts</li>
          <li><strong>2-Leg Vertical Spreads:</strong> Call debit spreads, call credit spreads, put debit spreads, and put credit spreads</li>
          <li><strong>Long Straddles and Long Strangles</strong></li>
          <li><strong>Calendar Spreads:</strong> Long call calendar spreads, long put calendar spreads, and short put calendar spreads</li>
          <li><strong>4-Leg Condors:</strong> Long call condor, short call condor, long put condor, short put condor, long iron condor, and short iron condor</li>
          <li><strong>4-Leg Butterflies:</strong> Long call butterfly, short call butterfly, long put butterfly, short put butterfly, long iron butterfly, and short iron butterfly</li>
          <li><strong>Unbalanced Ratios:</strong> Put front ratio, call back ratio, and put back ratio</li>
        </ul>

        <h3>Private by Design</h3>
        <p>No account necessary and no ads. Your screenshots are processed entirely on your device, and your trades never leave it. The app works completely offline with tickers, earnings, IV history, and dividend data refreshing in the background each week.</p>

        <h3>Built for Learning</h3>
        <p>Sharpen how you read a trade and grow the number of options strategies you can confidently use.</p>

        <p class="tv-disclaimer">TradeVision Edge is an educational tool and is not investment advice, not a broker, and never touches your brokerage account. Figures are theoretical model estimates, not live quotes. Options involve substantial risk and are not suitable for every investor.</p>
      </section>

      <footer>
        <p>&copy; 2026 Vishnu Muthiah. All rights reserved.</p>
        <p style="margin-top: 10px;">
          <a href="/">Home</a> |
          <a href="/privacy-policy">Privacy Policy</a> |
          <a href="/terms-of-service">Terms of Service</a>
        </p>
      </footer>
    </div>

    ${getDemoVideosScript()}
  `, getTradeVisionPageStyles(), {
    description: 'Turn a Robinhood options screenshot into an interactive P&L chart. Model days-to-expiration and implied volatility, then read your Greeks and break-evens — all privately on your iPhone.',
    image: 'https://raw.githubusercontent.com/vishnuamuthiah/vishnuamuthiah.com/main/tradevision/payoff-chart.png',
    url: 'https://vishnumuthiah.com/tradevision',
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
