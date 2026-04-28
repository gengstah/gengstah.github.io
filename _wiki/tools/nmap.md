---
title: "nmap"
permalink: /wiki/tools/nmap/
layout: single
author_profile: true
tags:
  - pentest
  - tool
sidebar:
  nav: "wiki"
---

*The reference network scanner. Service discovery, version detection, scriptable probes.*

**Status:** seed
**Related:** [Reconnaissance](/wiki/techniques/recon/), [Penetration Testing](/wiki/domains/penetration-testing/)

---

## Why it still matters

Faster scanners exist (`masscan`, `rustscan`, `naabu`). None of them give you nmap's combination of **service-version detection**, **OS fingerprinting**, and the **NSE script library** in one tool. The 2026 workflow is `masscan` for the first sweep across a /16, then nmap-deep on every open port.

---

## Useful invocations

```bash
# Top 1000 TCP ports, default scripts, version detection — the standard
nmap -sC -sV -oA scan_$(date +%Y%m%d) <target>

# Full TCP port range, then version-detect only the open ports (fast)
nmap -p- --min-rate 5000 -oA full_$(date +%Y%m%d) <target>
nmap -sC -sV -p$(cat full_*.gnmap | grep -oP '\d+/open' | cut -d/ -f1 | sort -u | paste -sd,) <target>

# UDP — slow, but skipping it leaves DNS/SNMP/IKE/RPC/NFS unmapped
sudo nmap -sU --top-ports 50 -oA udp_$(date +%Y%m%d) <target>

# SMB enumeration via NSE
nmap --script "smb-enum-*,smb-vuln-*,smb-os-discovery" -p139,445 <target>

# HTTP enumeration
nmap --script "http-enum,http-title,http-headers,http-methods" -p80,443,8080,8443 <target>

# SSL/TLS
nmap --script "ssl-enum-ciphers,ssl-cert" -p443 <target>
```

---

## Output formats

Always use `-oA <basename>` to dump three formats at once:

- `.nmap` — human-readable.
- `.gnmap` — grep-friendly. `cat scan.gnmap | grep -oP '[\w.-]+\s+\(\)\s+Ports:\s+.*'` style processing.
- `.xml` — for tooling. Feeds into `eyewitness`, `metasploit`, `seccubus`, `nmap-formatter`, etc.

---

## NSE — the underused half

The `--script` library is enormous. A few categories worth knowing:

- `default` (`-sC`) — safe, fast, broad.
- `discovery` — additional info gathering.
- `vuln` — known-vuln checks (Heartbleed, Shellshock, MS17-010, etc.).
- `auth` — bruteforce, default-cred checks.
- `brute` — focused bruteforcers (use `--script-args 'unpwdb.timelimit=...'` to bound them).
- `safe` — guaranteed not to crash the target. Useful filter when scanning fragile devices.

Browse: <https://nmap.org/nsedoc/>.

---

## Tuning

| Flag | Effect |
|------|--------|
| `-T0`–`-T5` | Timing template; `-T4` for normal nets, `-T2` for OPSEC-sensitive or fragile targets |
| `--min-rate <pps>` / `--max-rate <pps>` | Bound the packet rate explicitly |
| `--max-retries 1` | Speed up at the cost of some accuracy |
| `-Pn` | Skip host discovery (treat all hosts as up) — necessary against ICMP-blocking targets |
| `--source-port 53` | Sometimes bypasses dumb stateful firewalls |
| `-D <decoy1>,<decoy2>,ME` | Decoy scanning — adds noise around your real source |
| `--proxies socks4://...` | Route through a SOCKS proxy (limited reliability) |
| `--script-trace` | See exactly what an NSE script is sending |

---

## OPSEC

Default nmap timing is loud. For [red team](/wiki/domains/red-teaming/) work:

- `-T1` or `-T2`, `--max-retries 1`, `--scan-delay`.
- Scan from a host that has a plausible reason to scan (an internal jump box), not from the open internet.
- Avoid version-detection probes (`-sV`) against monitored services — they send service-specific bytes that match IDS sigs.
- Prefer `connect()` scans (`-sT`) inside the LAN — half-open SYN scans are sometimes more conspicuous than full handshakes.

---

## References

- nmap reference guide — <https://nmap.org/book/man.html>
- NSE script database — <https://nmap.org/nsedoc/>
- *Nmap Network Scanning* — Gordon Lyon (Fyodor)
