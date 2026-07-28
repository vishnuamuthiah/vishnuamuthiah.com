#!/usr/bin/env python3
"""Generate legal-content.js from the iOS app's LegalView.swift.

The App Store's privacy/terms URLs must say the same thing the app says, so the
web copy is generated from the app's own source rather than maintained twice.
Re-run after any edit to LegalView.swift:

    python3 tools/extract-legal.py

Source of truth: ~/Developer/TradeVision/TradeVision/LegalView.swift
"""
import json
import os
import re
import sys

SWIFT = os.path.expanduser("~/Developer/TradeVision/TradeVision/LegalView.swift")
SHARE = os.path.expanduser("~/Developer/TradeVision/TradeVision/ContentView.swift")
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "legal-content.js")

src = open(SWIFT).read()


def swift_const(text, name, container=r"[A-Za-z]+"):
    m = re.search(rf'static let {name}\s*=\s*"([^"]*)"', text)
    if not m:
        sys.exit(f"could not find `static let {name}` -- did LegalView.swift change?")
    return m.group(1)


INFO = {
    "appName": swift_const(src, "appName"),
    "effectiveDate": swift_const(src, "effectiveDate"),
    "provider": swift_const(src, "provider"),
    "contactEmail": swift_const(src, "contactEmail"),
    "governingLaw": swift_const(src, "governingLaw"),
}
SHARE_HOST = swift_const(open(SHARE).read(), "host")


def unescape(s):
    """Resolve Swift \\u{XXXX} escapes and the \\(...) interpolations used here."""
    s = re.sub(r"\\u\{([0-9A-Fa-f]+)\}", lambda m: chr(int(m.group(1), 16)), s)
    subs = {
        r"\(LegalInfo.appName)": INFO["appName"],
        r"\(LegalInfo.effectiveDate)": INFO["effectiveDate"],
        r"\(LegalInfo.provider)": INFO["provider"],
        r"\(LegalInfo.provider.uppercased())": INFO["provider"].upper(),
        r"\(LegalInfo.contactEmail)": INFO["contactEmail"],
        r"\(LegalInfo.governingLaw)": INFO["governingLaw"],
        r"\(TradeShare.host)": SHARE_HOST,
    }
    # Longest first so `provider.uppercased()` isn't eaten by `provider`.
    for needle in sorted(subs, key=len, reverse=True):
        s = s.replace(needle, subs[needle])
    leftover = re.search(r"\\\(([^)]*)\)", s)
    if leftover:
        sys.exit(f"unresolved Swift interpolation: \\({leftover.group(1)})")
    if "\\u{" in s:
        sys.exit("unresolved \\u escape remains")
    return s


def document(key):
    """Pull one `static let <key> = LegalDocument(...)` block."""
    start = src.index(f"static let {key} = LegalDocument(")
    end = src.index("\n    )", start)
    block = src[start:end]
    title = re.search(r'title:\s*"([^"]*)"', block).group(1)
    summary = re.search(r'summary:\s*"([^"]*)"', block).group(1)
    sections = []
    for heading, body in re.findall(
        r'LegalSection\(\s*(nil|"(?:[^"]*)")\s*,\s*\n?\s*"([^"]*)"\s*\)', block
    ):
        sections.append({
            "heading": None if heading == "nil" else unescape(heading.strip('"')),
            "body": unescape(body),
        })
    if not sections:
        sys.exit(f"no sections parsed for {key} -- the LegalSection format changed")
    return {"key": key, "title": unescape(title), "summary": unescape(summary),
            "sections": sections}


docs = [document(k) for k in ("disclaimer", "privacy", "terms")]

# Read from the app rather than restated here. This was a hardcoded copy of the Swift
# string, which quietly defeated the point of generating the page at all: an edit to
# `finePrint` in LegalView.swift left the site showing the previous wording, and nothing
# failed to say so. `swift_const` exits non-zero if the constant moves or is renamed.
fine_print = unescape(swift_const(src, "finePrint"))

banner = (
    "// GENERATED FILE -- DO NOT EDIT BY HAND.\n"
    "// Produced by tools/extract-legal.py from the iOS app's LegalView.swift, so the\n"
    "// web copy of the Privacy Policy, Terms of Use and Financial Disclaimer is always\n"
    "// the same text the app shows. Edit LegalView.swift, then re-run the script.\n"
)

with open(OUT, "w") as f:
    f.write(banner)
    f.write("\nexport const LEGAL_INFO = " + json.dumps(INFO, indent=2) + ";\n")
    f.write("\nexport const LEGAL_FINE_PRINT = " + json.dumps(fine_print) + ";\n")
    f.write("\nexport const LEGAL_DOCS = " + json.dumps(docs, indent=2) + ";\n")

counts = ", ".join(f"{d['key']}={len(d['sections'])}" for d in docs)
print(f"wrote {OUT} ({counts} sections)")
