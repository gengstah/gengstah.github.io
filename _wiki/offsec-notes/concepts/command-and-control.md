---
title: Command and Control (C2)
permalink: /wiki/offsec-notes/concepts/command-and-control/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
---

**Category:** Post-Exploitation / Infrastructure
**MITRE ATT&CK:** Command and Control — TA0011
**Related:** [Post Exploitation](/wiki/offsec-notes/concepts/post-exploitation/), [Lateral Movement](/wiki/offsec-notes/concepts/lateral-movement/), [Evasion Techniques](/wiki/offsec-notes/concepts/evasion-techniques/), [Red Teaming](/wiki/offsec-notes/concepts/red-teaming/)

## Overview
Command and Control (C2) is the mechanism by which an attacker maintains persistent, covert communication with compromised hosts. Modern C2 frameworks provide encrypted channels, beaconing, pivoting, payload staging, and built-in post-exploitation modules. C2 infrastructure design directly impacts both operational capability and detection risk.

## How It Works

### C2 Architecture
```
Attacker Operator
      |
  Team Server (C2 Server)
      |  (encrypted, often HTTPS/DNS/ICMP)
  Redirector(s)   ← hides true C2 server IP
      |
  Implant/Beacon  ← running on compromised host
```

**Redirectors:** Apache/nginx with mod_rewrite, Cloudflare, or dedicated VM. True C2 IP never exposed to target network. Rules pass only valid beacon traffic to C2; everything else gets 200 OK with benign content (domain fronting, CDN abuse).

### Communication Protocols
| Protocol | Stealth | Notes |
|----------|---------|-------|
| HTTPS | High | Most common; blends with web traffic |
| DNS | Very High | Slow; useful through restrictive firewalls |
| SMB | Medium | Lateral comms between beacons (peer-to-peer) |
| ICMP | Medium | Blocked outbound in many environments |
| HTTP | Low | Plaintext; detected by DPI |
| Custom protocol | Variable | Requires custom malleable C2 profile |

### Malleable C2 Profiles (Cobalt Strike concept)
Define beacon behavior: check-in interval, jitter, HTTP headers, URIs, user-agent, response body. Mimic legitimate software (Google updates, Office telemetry) to evade network-based detection.

### Beaconing & Sleep
- Beacon interval with jitter (e.g., 60s ± 30%) to avoid periodic pattern detection.
- Long sleep times reduce detection but slow operations.
- Sleep while EDR is active; wake during gaps or off-hours.

### Popular C2 Frameworks
| Framework | Language | License | Notes |
|-----------|----------|---------|-------|
| Cobalt Strike | Java/.NET | Commercial | Industry standard for red teams |
| Sliver | Go | Open source (BishopFox) | Strong alternative; mTLS/WireGuard |
| Havoc | C/C++ | Open source | Modern, extendable |
| Brute Ratel C4 | C++ | Commercial | OPSEC-focused, detection-evasion built-in |
| Metasploit Meterpreter | Ruby/C | Open source | Widely detected but fast for CTFs |
| Covenant | C# | Open source | .NET focused |
| PoshC2 | PowerShell | Open source | PS-heavy environments |
| NightHawk | — | Commercial | High-OPSEC, expensive |

## Attack Methodology
1. Set up redirector(s) with domain(s) aged ≥30 days.
2. Configure C2 server behind redirectors; never expose direct IP.
3. Generate payload (beacon/implant) with appropriate profile.
4. Deploy payload via initial access vector.
5. Operate through C2: post-ex, lateral movement, data collection.
6. Rotate infrastructure if indicators are burned.

## Detection & Evasion Notes
- **Detections:** JA3/JA3S fingerprinting on TLS, beacon periodicity analysis, DNS query volume/entropy, unusual outbound ports, process injection (Sysmon 8/10).
- **Evasion:**
  - Domain fronting via CDN (Cloudflare, Azure, Fastly).
  - HTTPS with legitimate-looking certificates (Let's Encrypt for aged domains).
  - Match beacon profile to expected software on the target.
  - Use process injection into signed processes (explorer, teams, chrome).
  - Sleep obfuscation (encrypted memory during sleep — Ekko, Foliage techniques).
  - Bring-your-own beacon via trusted software (DLL sideloading).

## Tools
- `Cobalt Strike` — commercial; most feature-complete
- `Sliver` — open-source Go C2 (BishopFox)
- `Havoc` — open-source modern C2
- `Metasploit` — Meterpreter; great for quick tests, high AV detection
- `apache-redirector` scripts, mod_rewrite rules
- `Nginx` as redirector with lua scripting
- `Malleable C2 profiles` — github.com/BC-SECURITY/Malleable-C2-Profiles

## References
- "Red Team Development and Operations" — Joe Vest
- C2 Matrix — thec2matrix.com (comparison of C2 frameworks)
- MITRE ATT&CK TA0011
- "Infrastructure for Red Teams" — blog.cobaltstrike.com
