---
title: Kerberoasting
permalink: /wiki/offsec-notes/concepts/kerberoasting/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
---

**Category:** Active Directory / Credential Access
**MITRE ATT&CK:** T1558.003 — Steal or Forge Kerberos Tickets: Kerberoasting
**Related:** [Active Directory Attacks](/wiki/offsec-notes/concepts/active-directory-attacks/), [Pass The Hash](/wiki/offsec-notes/concepts/pass-the-hash/), [Mimikatz](/wiki/offsec-notes/entities/mimikatz/), [Impacket](/wiki/offsec-notes/entities/impacket/)

## Overview
Kerberoasting abuses the Kerberos protocol to extract service account password hashes without admin privileges. Any authenticated domain user can request a TGS (Service Ticket) for any SPN-registered account; the TGS is encrypted with the service account's NT hash and can be cracked offline.

## How It Works
1. Attacker enumerates accounts with ServicePrincipalNames (SPNs) set — these are typically service accounts.
2. Attacker requests TGS tickets for those SPNs using standard Kerberos (`KerberosRequestorSecurityToken` or `GetTGS`).
3. TGS is encrypted with the service account's RC4-HMAC (etype 23) or AES key.
4. Attacker extracts the encrypted blob and cracks it offline with hashcat/john.
5. If the service account password is weak, plaintext is recovered in minutes.

### Why RC4 Matters
RC4 (etype 23) tickets are much faster to crack than AES128/AES256.
Modern AD defaults to AES; requesting RC4 may be blocked or flagged.
Force RC4 with Rubeus: `Rubeus.exe kerberoast /rc4opsec` (requests RC4 only if account doesn't have AES keys).

## Attack Methodology
```
# From Linux (Impacket)
GetUserSPNs.py domain.local/user:pass -dc-ip 10.10.10.1 -request -outputfile hashes.txt

# From Windows (Rubeus)
Rubeus.exe kerberoast /outfile:hashes.txt /nowrap

# Crack with hashcat
hashcat -m 13100 hashes.txt wordlist.txt -r rules/best64.rule

# AS-REP Roasting (no pre-auth required — different technique)
GetNPUsers.py domain.local/ -usersfile users.txt -no-pass -dc-ip 10.10.10.1
```

### Prioritization
- Target accounts in high-priv groups (Domain Admins, Server Operators, etc.)
- Target accounts with `AdminCount=1`
- Look for accounts with weak/old passwords (password policy, creation date)

## Detection & Evasion Notes
- **Detection:** Event ID 4769 (TGS request) with encryption type 0x17 (RC4) to service accounts that don't normally receive such requests. Baseline is noisy; ML-based anomaly detection is more reliable.
- **Evasion:**
  - Request AES tickets instead (less crackable but less detectable).
  - Request tickets slowly, one at a time.
  - Blend in with legitimate service ticket requests.
  - Target only high-value accounts rather than bulk requests.
- **Honeypot trap:** Defenders may create fake SPN accounts with attractive names and strong monitoring on any TGS request for them.

## Tools
- `Impacket GetUserSPNs.py` — Linux-based enumeration and hash extraction
- `Rubeus` — Windows-based, feature-rich, supports RC4/AES/opsec modes
- `PowerView` — `Invoke-Kerberoast` (PS)
- `hashcat -m 13100` — crack `$krb5tgs$23$` hashes
- `john` — alternative cracker

## References
- Tim Medin — "Attacking Kerberos: Kicking the Guard Dog of Hades" (DerbyCon 2014)
- MITRE ATT&CK T1558.003
- harmj0y — "Kerberoasting Without Mimikatz" (2016)
