---
title: "HTML Smuggling"
permalink: /wiki/concepts/html-smuggling/
layout: single
author_profile: true
tags:
  - phishing
  - initial-access
  - html-smuggling
  - outflank
---

*Reconstructing a malicious file inside the victim's browser from JavaScript and a Blob, so the file is born on disk locally rather than crossing the network as a recognisable payload. Outflank's 2018 explainer is the canonical write-up.*

**Status:** drafting
**Related:** [Mark-of-the-Web](/wiki/concepts/mark-of-the-web/), [Office macro tradecraft](/wiki/concepts/office-macro-tradecraft/), [Phishing](/wiki/concepts/phishing/), [Outflank blog catalogue](/wiki/resources/outflank/)

---

## The pattern

A landing page contains JavaScript that:

1. Holds the payload as a base64-encoded (or AES-encrypted) string inside the page.
2. Decodes it into a `Uint8Array` at runtime.
3. Wraps it in a `Blob`.
4. Either auto-downloads via `URL.createObjectURL()` + a synthetic `<a download>` click, or saves via `navigator.msSaveOrOpenBlob` (legacy) / `showSaveFilePicker` (modern).

Minimal example:

```html
<script>
  const payloadB64 = "TVqQAAMAAAAEAAAA//8AAL...";
  const bytes = Uint8Array.from(atob(payloadB64), c => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: "application/octet-stream" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "InvoiceQ4.iso";
  document.body.appendChild(a);
  a.click();
</script>
```

The user lands on `https://lure.example/invoice` and a `.iso` (or `.zip`, `.lnk`, `.docm`) just appears in their Downloads folder.

## What it bypasses

- **Network IDS / sandbox** never sees the payload as a file. It crosses the wire as base64 string concatenation inside JavaScript inside an HTTP response.
- **Email gateway** sees only a benign HTTPS link.
- **Web proxy / SWG** sees an HTML page; if it inspects, the payload is encoded.
- **Application allowlists keyed on file source URL** — the file is born locally; its provenance is the JavaScript origin, not a remote MIME-typed download.

## What it doesn't bypass

- **[Mark-of-the-Web](/wiki/concepts/mark-of-the-web/)** still gets applied by Edge / Chrome to downloads from non-trusted zones. Office Protected View kicks in. Combine HTML smuggling with a container format (.ISO, .IMG, .VHD, mounted-by-double-click) that historically *strips* MotW from contained files. Microsoft has progressively closed those gaps (Win11 22H2: ISO mounts now propagate MotW).
- **EDR-on-the-endpoint** sees the resulting file as it's written and scans it. The wire-level evasion buys you the gap between download and detonation; if the payload is also AMSI-malicious you still trip on execution.

## Operational recipe (post-MotW)

1. Lure URL → JS → in-browser Blob construction.
2. Output is a `.zip` containing a `.lnk` plus a hidden helper. Many corporate users routinely double-click `.zip` → `.lnk` and the LNK fires.
3. The LNK runs a signed LOLBin (`mshta`, `regsvr32`, `rundll32`) with arguments that pull the next stage.
4. Final payload runs in the LOLBin's process.

In 2026 the most common variant is HTML smuggling → password-protected `.zip` → `.lnk` → AMSI-bypass → in-memory C2 implant.

## Detection

- Outbound-to-inbound flip: the user's machine receives a JS page, then writes a file the network never carried in clean form. EDR can correlate browser-process creation with file write events.
- Yara rules on common base64 patterns (PE header `TVqQ`, etc.) inside HTML.
- Browser policy: block downloads from JavaScript on classified-untrusted zones (Edge "Mark of the Web" controls).
- Group Policy: disable mounting of ISO/IMG by double-click for non-admin users.

## See also

- [Mark-of-the-Web](/wiki/concepts/mark-of-the-web/) — the residual control that HTML smuggling has to beat.
- [Office macro tradecraft](/wiki/concepts/office-macro-tradecraft/) — what HTML smuggling typically delivers.
- [Phishing](/wiki/concepts/phishing/), [LNK file attacks](/wiki/concepts/lnk-file-attacks/).

## References

- Outflank — Stan Hegt — *HTML smuggling explained* (2018-08-14) — <https://www.outflank.nl/blog/2018/08/14/html-smuggling-explained/>
- Microsoft Defender Threat Intelligence — *HTML smuggling surges*.
