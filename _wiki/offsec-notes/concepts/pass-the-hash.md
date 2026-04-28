---
title: Pass-the-Hash (PtH) / Pass-the-Ticket (PtT)
permalink: /wiki/offsec-notes/concepts/pass-the-hash/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
---

# Pass-the-Hash (PtH) / Pass-the-Ticket (PtT)

**Category:** Active Directory / Credential Access / Lateral Movement
**MITRE ATT&CK:** T1550.002 (PtH), T1550.003 (PtT)
**Related:** [Active Directory Attacks](/wiki/offsec-notes/concepts/active-directory-attacks/), [Lateral Movement](/wiki/offsec-notes/concepts/lateral-movement/), [Mimikatz](/wiki/offsec-notes/entities/mimikatz/), [Impacket](/wiki/offsec-notes/entities/impacket/)

## Overview
Pass-the-Hash allows an attacker to authenticate as a user using their NTLM hash without knowing the plaintext password. NTLM authentication sends a challenge-response using the hash directly, so the hash itself IS the credential. Pass-the-Ticket is the Kerberos equivalent — using a stolen TGT or TGS to authenticate.

## How It Works

### Pass-the-Hash (NTLM)
- Extract NTLM hash from LSASS memory, SAM database, NTDS.dit, or network capture.
- Use hash directly in NTLM authentication flows.
- Works for local accounts (including local admin) and domain accounts.
- **Local admin PtH:** Effective if target shares the same local admin password (common before LAPS).
- **UAC remote restriction:** By default, only the built-in Administrator (RID 500) can PtH to admin shares remotely; other local admins are blocked unless `LocalAccountTokenFilterPolicy=1`.

### Pass-the-Ticket (Kerberos)
- Steal TGT from LSASS (requires local admin).
- Inject TGT into current session → request TGS for any service.
- Overpass-the-Hash (Pass-the-Key): convert NTLM hash to Kerberos TGT using AS-REQ with RC4 encryption.

### Over-Pass-the-Hash
Convert an NT hash directly into a usable Kerberos TGT — avoids NTLM entirely for better OPSEC.

## Attack Methodology
```
# Dump hashes from LSASS (Mimikatz)
sekurlsa::logonpasswords

# PtH with Impacket
psexec.py -hashes :NTLMhash domain/user@target
wmiexec.py -hashes :NTLMhash domain/user@target
smbexec.py -hashes :NTLMhash domain/user@target

# PtH with CrackMapExec/NetExec
nxc smb 10.10.10.0/24 -u Administrator -H NTLMhash --local-auth

# PtT with Mimikatz (steal + inject)
sekurlsa::tickets /export
kerberos::ptt ticket.kirbi

# PtT with Rubeus
Rubeus.exe dump /luid:0xNNNN /nowrap
Rubeus.exe ptt /ticket:base64blob

# Overpass-the-Hash (Rubeus)
Rubeus.exe asktgt /user:victim /rc4:NTLMhash /ptt
```

## Detection & Evasion Notes
- **Detection:** NTLM auth events (4776) from workstations to servers they don't normally access. Kerberos TGT requests with RC4 encryption where AES is expected.
- **Evasion:**
  - Prefer Kerberos PtT over NTLM PtH — NTLM is increasingly monitored.
  - Use `wmiexec` or `atexec` instead of `psexec` — psexec leaves a service creation event (7045).
  - Overpass-the-Hash generates legitimate-looking Kerberos traffic.
  - Use `--exec-method smbexec` for fileless execution.
- **LAPS:** Defeats local admin PtH by randomizing local admin passwords per machine.
- **Credential Guard:** Blocks LSASS credential extraction; Kerberos tickets isolated in VSM.

## Tools
- `Mimikatz` — extract hashes and tickets from LSASS
- `Impacket` — psexec, wmiexec, smbexec, atexec, smbclient
- `Rubeus` — Kerberos PtT, overpass-the-hash, ticket manipulation
- `CrackMapExec` / `NetExec` — bulk PtH across a subnet
- `xfreerdp` with `/pth:` — RDP using hash (NLA must be disabled)

## References
- Mark Russinovich, "Pass-the-Hash" (2012)
- MITRE ATT&CK T1550.002, T1550.003
- harmj0y — "The Evolution of Pass-the-Hash Attacks" blog posts
