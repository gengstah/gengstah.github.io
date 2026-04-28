---
title: "Lateral Movement"
permalink: /wiki/techniques/lateral-movement/
layout: single
author_profile: true
tags:
  - red-team
  - pentest
sidebar:
  nav: "wiki"
---

*Reusing access from one host to reach another.*

**Status:** seed
**Related:** [Privilege Escalation](/wiki/techniques/privilege-escalation/), [Persistence](/wiki/techniques/persistence/), [OPSEC](/wiki/concepts/opsec/)

{% include toc %}

---

## The two halves

Lateral movement has two questions:

1. **Authentication** — what credential or token will the next host accept?
2. **Execution** — once authenticated, how do you get code running there?

Different combinations have different OPSEC profiles. A skilled operator picks the combination by what the org actually monitors.

---

## Authentication primitives

| Primitive | What it is | Notable detection |
|-----------|------------|-------------------|
| **Pass-the-Hash (PtH)** | Use NTLM hash directly without knowing the plaintext | NTLM auth from non-typical source |
| **Pass-the-Ticket (PtT)** | Inject a Kerberos TGT/TGS and use it | Ticket without prior TGT request, ticket lifetime mismatches |
| **Overpass-the-Hash** | Use NT hash to request a Kerberos TGT | Looks like normal Kerberos but originates from a hash you shouldn't have |
| **Silver Ticket** | Forge a TGS for a specific service | TGS without preceding AS-REQ |
| **Golden Ticket** | Forge a TGT signed with `krbtgt` hash | Long ticket lifetimes; impossible group membership; krbtgt rotation invalidates |
| **DCSync abuse** | Replicate hashes from a DC | DRSReplica events from non-DC source |
| **Token impersonation** | Steal a primary or impersonation token | Token use mismatched with logon session |
| **Shadow Credentials** | Auth as another principal via PKINIT cert | `msDS-KeyCredentialLink` modification + cert auth |

`mimikatz`, `Rubeus`, and `impacket` cover most of these.

---

## Execution primitives

Once you have an accepted credential or token, you need to *run* something on the target.

| Mechanism | Transport | Notes |
|-----------|-----------|-------|
| **SMB + Service Control (psexec-style)** | SMB, MSRPC | Loud. Service install + named pipe. The classic; heavily monitored. |
| **WMI (`wmic`, `Invoke-WmiMethod`, `wmiexec.py`)** | DCOM/MSRPC over 135+dynamic | Less monitored than SMB historically; not anymore. |
| **WinRM (`Invoke-Command`, `evil-winrm`)** | HTTP(S) over 5985/5986 | Looks like legitimate admin tooling on environments that use it. |
| **DCOM (MMC20.Application, ShellWindows, ShellBrowserWindow, Excel.Application)** | DCOM over 135+dynamic | Quieter than psexec; defenders learned this years ago. |
| **Scheduled tasks (`schtasks /create /S`)** | RPC | Logged via task creation events. |
| **Service Control Manager (`sc.exe \\host create`)** | RPC | Same as psexec underneath. |
| **RDP** | RDP/3389 | Interactive; rich logging; visible to anyone watching the box. |
| **SSH (Linux/cross-platform)** | SSH/22 | The go-to on Linux fleets and increasingly Windows. |

For red-team work, the choice depends on what the org's normal admin traffic looks like. WinRM is invisible if the org uses Ansible / DSC; loud if it doesn't.

---

## A representative chain

A common path through an AD network:

1. Land as standard user (phish).
2. [Local priv-esc](/wiki/techniques/privilege-escalation/) on the workstation → local admin.
3. Dump LSASS / DPAPI / browser creds → harvest cached credentials, tokens, Kerberos tickets.
4. BloodHound the environment from the workstation user's perspective.
5. Find a path: e.g. `WORKSTATION-ADMINS` group → owns a `Help Desk` group → has `WriteDACL` over `Tier 1 Server Admins` → reset a member's password → log in.
6. Move laterally via WMI to the helpdesk box.
7. Repeat — privesc, dump, enumerate, move — until you reach Tier 0 (DC / ADCS / Entra Connect).
8. DCSync `krbtgt` for a Golden Ticket as escape hatch / persistence.

The pattern is *small jumps along the BloodHound graph*, not heroic single-shot domain compromise.

---

## OPSEC

[OPSEC](/wiki/concepts/opsec/) for lateral movement specifically:

- **Match the org's admin pattern.** If admins move via WinRM, you move via WinRM. If they psexec, you psexec.
- **Source the auth from a plausible host.** A Tier 0 admin login from a developer workstation is suspicious; from a jump box it's not.
- **Don't fan out.** Touching 50 hosts in 10 minutes is the brightest signal you can generate. Stay narrow.
- **Account for replication.** Some attacks (DCSync, certain ticket forgeries) replicate to other DCs and trigger anomaly detections that don't fire on the local DC.

---

## References

- MITRE ATT&CK TA0008 — <https://attack.mitre.org/tactics/TA0008/>
- Will Schroeder / SpecterOps blog — extensive lateral-movement tradecraft
- *The Hacker Playbook 3* — Peter Kim
- Adam Chester (xpn) — token / Kerberos write-ups
