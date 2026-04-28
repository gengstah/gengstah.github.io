---
title: Nmap
permalink: /wiki/offsec-notes/entities/nmap/
layout: single
author_profile: true
tags:
- offsec-notes
- tool
---

**Type:** Tool
**Also known as:** Network Mapper
**Related:** [Network Scanning](/wiki/offsec-notes/concepts/network-scanning/), [Reconnaissance](/wiki/offsec-notes/concepts/reconnaissance/), [Vulnerability Assessment](/wiki/offsec-notes/concepts/vulnerability-assessment/)

## Description
Nmap is the industry-standard network discovery and security auditing tool. It uses raw IP packets to determine what hosts are available, what services they run, what OS they use, and dozens of other characteristics. Includes the Nmap Scripting Engine (NSE) for automated service enumeration.

## Usage / Details

### Essential Commands
```bash
# Host discovery (no port scan)
nmap -sn 10.10.10.0/24

# Fast top-1000 port scan
nmap -T4 -F 10.10.10.1

# Full port scan with version + scripts
nmap -p- -sV -sC -T4 10.10.10.1 -oA scan_results

# Stealth SYN scan (root required)
nmap -sS -p- 10.10.10.1

# UDP scan (slow; target important ports)
nmap -sU -p 53,67,68,69,123,161,162,500,1900 10.10.10.1

# OS detection (root required)
nmap -O 10.10.10.1

# All: OS + version + scripts + traceroute
nmap -A 10.10.10.1

# Output formats
nmap ... -oN normal.txt   # Human readable
nmap ... -oX scan.xml     # XML (import to tools)
nmap ... -oG grep.txt     # Grepable
nmap ... -oA all_formats  # All three
```

### Useful NSE Scripts
```bash
# SMB enumeration
nmap --script smb-enum-shares,smb-enum-users,smb-os-discovery -p 445 10.10.10.1

# Vulnerability scan
nmap --script vuln 10.10.10.1

# HTTP enumeration
nmap --script http-title,http-headers,http-methods,http-robots.txt -p 80,443,8080,8443 10.10.10.1

# LDAP
nmap --script ldap-search,ldap-rootdse -p 389,636 10.10.10.1

# DNS zone transfer
nmap --script dns-zone-transfer --script-args dns-zone-transfer.domain=domain.local -p 53 10.10.10.1
```

### Timing Templates
| Template | Name | Use Case |
|----------|------|----------|
| -T0 | Paranoid | IDS evasion; very slow |
| -T1 | Sneaky | IDS evasion; slow |
| -T2 | Polite | Don't overload network |
| -T3 | Normal | Default |
| -T4 | Aggressive | Fast; good for labs |
| -T5 | Insane | Fastest; may miss ports |

### Evasion Options
```bash
-f                # Fragment packets
-D RND:10         # Decoy IPs
--source-port 53  # Spoof source port (firewall bypass)
--randomize-hosts # Randomize scan order
--data-length 25  # Append random data to packets
```

## References
- "Nmap Network Scanning" — Gordon Lyon (Fyodor), the official book
- NSE documentation — nmap.org/nsedoc
