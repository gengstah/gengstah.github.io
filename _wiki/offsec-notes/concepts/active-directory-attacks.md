---
title: Active Directory Attacks
permalink: /wiki/offsec-notes/concepts/active-directory-attacks/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
---

**Category:** Active Directory / Windows
**MITRE ATT&CK:** Multiple — Credential Access, Lateral Movement, Privilege Escalation
**Related:** [Kerberoasting](/wiki/offsec-notes/concepts/kerberoasting/), [Pass The Hash](/wiki/offsec-notes/concepts/pass-the-hash/), [Lateral Movement](/wiki/offsec-notes/concepts/lateral-movement/), [Privilege Escalation Windows](/wiki/offsec-notes/concepts/privilege-escalation-windows/), [Bloodhound](/wiki/offsec-notes/entities/bloodhound/), [Mimikatz](/wiki/offsec-notes/entities/mimikatz/)

## Overview
Active Directory (AD) is the dominant identity and access management system in enterprise Windows environments. It is the primary target in most internal penetration tests and red team operations because compromise of AD equals compromise of the entire domain — and often the forest. AD attack paths typically chain enumeration → credential abuse → lateral movement → DA/EA escalation.

## How It Works

### AD Fundamentals (Attack-Relevant)
- **Domain Controller (DC):** Authenticates users, stores the NTDS.dit (all domain hashes).
- **Kerberos:** Default auth protocol. Tickets (TGT, TGS) issued by KDC (DC).
- **NTLM:** Legacy auth, still widely used; vulnerable to relay and pass-the-hash.
- **LDAP:** Used to query AD objects (users, groups, GPOs, trusts).
- **Group Policy (GPO):** Can be abused for code execution if write access is granted.
- **ACLs/ACEs:** Object-level permissions; misconfigured ACLs are a major attack path.

### Attack Categories

#### Enumeration
- BloodHound/SharpHound — graph-based attack path discovery
- LDAP queries — users, groups, SPNs, AdminCount, unconstrained delegation
- PowerView / ADSearch — PowerShell-based AD enumeration

#### Credential Attacks
- Kerberoasting — request TGS for SPN accounts, crack offline (see [Kerberoasting](/wiki/offsec-notes/concepts/kerberoasting/))
- AS-REP Roasting — accounts with "Do not require Kerberos pre-auth"
- Password spraying — low-and-slow against domain accounts
- Pass-the-Hash / Pass-the-Ticket (see [Pass The Hash](/wiki/offsec-notes/concepts/pass-the-hash/))

#### Privilege Escalation
- ACL abuse: WriteDACL, GenericAll, GenericWrite, AddMember, ForceChangePassword
- GPO abuse: write access to GPO → deploy payload to OUs
- Unconstrained delegation — capture TGTs of connecting users/computers
- Constrained delegation (S4U2Proxy) abuse
- Resource-Based Constrained Delegation (RBCD) — write `msDS-AllowedToActOnBehalfOfOtherIdentity`
- Shadow Credentials — write `msDS-KeyCredentialLink` to add attacker cert
- PrintNightmare (CVE-2021-34527) / Zerologon (CVE-2020-1472)

#### Domain Dominance
- DCSync — replicate NTDS from DC without being on DC
- Golden Ticket — forge TGT using KRBTGT hash
- Silver Ticket — forge TGS using service account hash
- Diamond/Sapphire Tickets — OPSEC-improved alternatives to Golden Ticket
- DSRM abuse — use local admin hash of DC
- Skeleton Key — inject master password into LSASS (persistence)

#### Forest/Trust Attacks
- Trust ticket forgery (ExtraSids) — escalate from child to parent domain
- Foreign group membership — cross-domain group abuse

## Detection & Evasion Notes
- BloodHound collection is noisy (LDAP queries, SMB enumeration); use `--stealth` or LDAP-only collection.
- Kerberoasting detectable via 0x17 encryption type TGS requests.
- DCSync generates specific replication events (4662 with GUID).
- Golden Tickets with non-standard lifetimes (>10h) or using RC4 when AES is expected are detectable.
- Use AES256 tickets where possible; avoid RC4 (etype 23) which is increasingly monitored.

### Honeypot Accounts for Password Spray Detection
A zero-false-positive detection method for password spraying uses a honeypot AD account that should never authenticate. Any logon attempt — successful or failed — is a confirmed spray indicator.

**Setup:**
1. Reuse an old account (real logon history, real attributes); rename it to look like a standard user
2. Scramble the password: enable "Smart card required for interactive logon" → uncheck → password is now unguessable
3. Remove group memberships that provide resource access
4. Place in normal user OU structure, fill in standard fields (department, email, etc.)
5. Create one honeypot per domain (use name variations: Joe Fox, Samantha Fox, Ed Fox)

**Audit policy required on DCs:**
- `Audit Logon` — Success + Failure (event IDs 4624, 4625)
- `Audit Kerberos Authentication Service` — Success + Failure (event IDs 4768, 4771)
- `Audit Kerberos Service Ticket Operations` — Success (event ID 4769)

**Event IDs to alert on for honeypot account:**
| Event ID | Meaning | Auth Type |
|----------|---------|-----------|
| 4625 | Failed logon (bad password) | NTLM |
| 4771 failure code 0x18 | Kerberos pre-auth failed (bad password) | Kerberos |
| 4624 | Successful logon | Any |
| 4768 | TGT requested | Kerberos |

Alert on **any** of these events for the honeypot account — there is no legitimate reason for it to authenticate. This eliminates false positives that plague time-based spray detection.

## Tools
- `BloodHound` / `SharpHound` / `BloodHound.py` — attack path analysis
- `Impacket` suite — DCSync, AS-REP roasting, relay attacks, Kerberos manipulation
- `Mimikatz` — credential dumping, Golden/Silver tickets, DCSync
- `Rubeus` — Kerberos abuse toolkit (.NET)
- `PowerView` / `SharpView` — AD enumeration
- `CrackMapExec` / `NetExec` — SMB/WinRM/LDAP swiss-army knife
- `Certipy` — AD CS (certificate services) attacks
- `LDAPDomainDump` / `ldapx` — LDAP enumeration

## References
- SpecterOps BloodHound documentation
- harmj0y blog — AD attack techniques
- MITRE ATT&CK Enterprise — Active Directory techniques
- "The Hacker Recipes" — thehacker.recipes
