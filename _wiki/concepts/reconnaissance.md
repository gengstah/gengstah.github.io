---
title: Reconnaissance
permalink: /wiki/concepts/reconnaissance/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
redirect_from:
- /wiki/concepts/reconnaissance/
---

**Category:** General / Pre-Engagement
**MITRE ATT&CK:** Reconnaissance — TA0043
**Related:** [Network Scanning](/wiki/concepts/network-scanning/), [Social Engineering](/wiki/concepts/social-engineering/), [Phishing](/wiki/concepts/phishing/), [Vulnerability Assessment](/wiki/concepts/vulnerability-assessment/)

## Overview
Reconnaissance is the first phase of any offensive engagement. The goal is to collect as much information as possible about the target — infrastructure, personnel, technologies, and exposed attack surface — without triggering defenses. It is divided into passive (no direct contact with target) and active (direct interaction) sub-phases.

## How It Works

### Passive Reconnaissance
No packets touch the target's infrastructure directly.
- OSINT from public sources: WHOIS, DNS records, certificate transparency logs, Shodan, Censys
- Social media profiling (LinkedIn for org chart, GitHub for code leaks, job postings for tech stack)
- Google dorking (`site:`, `filetype:`, `inurl:`, `intitle:`)
- Historical data: Wayback Machine, PassiveDNS, VirusTotal passive DNS

### Active Reconnaissance
Direct interaction with target systems.
- DNS enumeration (zone transfers, brute-force subdomains)
- Port scanning and service fingerprinting
- Web crawling and directory brute-force
- SMTP user enumeration

## Attack Methodology
1. Define scope and objectives.
2. Passive: enumerate domains, IPs, ASNs, emails, employees, technologies.
3. Map the external attack surface (subdomains, cloud assets, exposed services).
4. Identify high-value targets: VPNs, mail servers, web apps, remote access portals.
5. Active: scan in-scope IPs, fingerprint services, enumerate web content.
6. Feed findings into vulnerability assessment and exploitation phases.

## Detection & Evasion Notes
- Passive recon is invisible to the target.
- Active scanning generates logs (firewall, IDS, web server).
- Evasion: slow scans (`nmap -T1`), decoy IPs, scan from multiple sources, rotate user-agents for web requests.
- Certificate transparency monitoring (crt.sh) reveals subdomains without touching the target.

## Tools
- `amass` — subdomain enumeration (passive + active)
- `theHarvester` — emails, subdomains, IPs from public sources
- `shodan` / `censys` — internet-wide banner scanning databases
- `subfinder` — fast passive subdomain discovery
- `dnsx` — DNS resolution and brute-force
- `httpx` — HTTP probing of discovered hosts
- `recon-ng` — modular OSINT framework
- `maltego` — graphical link-analysis OSINT

## References
- PTES Technical Guidelines — Pre-Engagement section
- MITRE ATT&CK TA0043 Reconnaissance (2023)
