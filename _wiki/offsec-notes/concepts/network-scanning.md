---
title: Network Scanning
permalink: /wiki/offsec-notes/concepts/network-scanning/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
---

# Network Scanning

**Category:** Network
**MITRE ATT&CK:** Discovery — T1046 (Network Service Discovery)
**Related:** [Reconnaissance](/wiki/offsec-notes/concepts/reconnaissance/), [Vulnerability Assessment](/wiki/offsec-notes/concepts/vulnerability-assessment/), [Lateral Movement](/wiki/offsec-notes/concepts/lateral-movement/)

## Overview
Network scanning identifies live hosts, open ports, running services, and OS/version information on a target network. It is a core step in both external and internal penetration tests, informing the attack surface for subsequent exploitation.

## How It Works

### Host Discovery
Determine which IPs are live before port scanning to avoid wasting time.
- ICMP ping sweep (`nmap -sn`)
- ARP scan on local segment (`arp-scan`, `netdiscover`)
- TCP/UDP probes to common ports

### Port Scanning
- **SYN scan** (`nmap -sS`) — half-open, stealthier, requires root
- **Connect scan** (`nmap -sT`) — full TCP handshake, no root needed
- **UDP scan** (`nmap -sU`) — slow, important for DNS/SNMP/TFTP
- **NULL/FIN/Xmas** — firewall evasion on some stacks

### Service & Version Detection
`nmap -sV` fingerprints service banners. Combine with `-sC` (default scripts) for automated enumeration (e.g., SMB shares, HTTP titles, SSL certs).

### OS Detection
`nmap -O` — TCP/IP stack fingerprinting. Requires root and at least one open + one closed port.

## Attack Methodology
1. Host discovery across the full RFC 1918 range (internal) or CIDR (external).
2. Full port scan on live hosts (`-p-` or top 5000 ports for speed).
3. Service/version detection + NSE scripts on interesting ports.
4. Export results to XML → import into reporting/vuln management tools.
5. Identify attack vectors: outdated services, default creds ports (23, 21, 161), management interfaces.

## Detection & Evasion Notes
- SYN scans are logged by stateful firewalls and most IDS.
- Evasion: fragment packets (`-f`), use decoys (`-D`), slow timing (`-T1`/`-T2`), randomize host order (`--randomize-hosts`).
- Masscan is much faster than nmap but noisier; use for initial sweep then nmap for detail.
- Some environments use port-knocking or firewall rules that drop unrecognized sources — passive listening (ARP, broadcast traffic) can be more revealing internally.

## Tools
- `nmap` — industry-standard scanner; NSE script library
- `masscan` — high-speed SYN scanner (millions of ports/second)
- `rustscan` — fast Rust-based port scanner, pipes to nmap
- `arp-scan` — Layer 2 host discovery on local segment
- `netdiscover` — ARP-based host discovery
- `unicornscan` — async UDP/TCP scanner
- `zmap` — internet-scale single-packet TCP/UDP scanner

## References
- Gordon Lyon, "Nmap Network Scanning" (official book)
- MITRE ATT&CK T1046 Network Service Discovery
