#!/usr/bin/env python3
"""Copy the share fallback page from the iOS repo into this one.

`web/p/index.html` in the app repo is the source of truth: it decodes the exact
payload `TradeShare` encodes, so the two have to stay in lockstep. The Worker
serves the same page at optionsvision.app/p/<payload>, and Cloudflare Pages
serves it at the legacy tradevision-web.pages.dev for links shared before the
domain move. This script keeps this repo's copy identical to the app repo's.

    python3 tools/sync-share-page.py

Edit ~/Developer/TradeVision/web/p/index.html, re-run this, then deploy BOTH:
    npx wrangler deploy                                    # optionsvision.app
    cd ~/Developer/TradeVision && npx wrangler pages deploy web \
        --project-name=tradevision-web --branch=main       # legacy host
"""
import os
import sys

SRC = os.path.expanduser("~/Developer/TradeVision/web/p/index.html")
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DST = os.path.join(REPO, "share-page.html")

if not os.path.exists(SRC):
    sys.exit(f"source page not found: {SRC}")

page = open(SRC).read()

# The Worker imports this as a Text module, so the content is served verbatim --
# no template-string escaping to get wrong. Sanity-check the two contracts the
# page has to satisfy before overwriting a known-good copy.
# The payload is read out of the path by a regex literal (`/\/p\/([^/?#]+)/`),
# so match on that rather than a bare "/p/", which never appears unescaped.
if "location.pathname" not in page or r"\/p\/" not in page:
    sys.exit("share page no longer reads the payload from the /p/ path -- check its parsing")
if "<html" not in page.lower():
    sys.exit("share page does not look like a full HTML document")

open(DST, "w").write(page)
print(f"synced {len(page):,} bytes -> {DST}")
