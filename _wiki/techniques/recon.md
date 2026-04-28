---
title: "Reconnaissance"
permalink: /wiki/techniques/recon/
layout: single
author_profile: true
tags:
  - pentest
  - red-team
---

*Mapping the target before touching it.*

**Status:** seed
**Related:** [Penetration Testing](/wiki/domains/penetration-testing/), [Red Teaming](/wiki/domains/red-teaming/), [nmap](/wiki/tools/nmap/), [Initial Access](/wiki/techniques/initial-access/)

{% include toc %}

---

## Passive vs. active

| Passive | Active |
|---------|--------|
| No packet ever leaves your control plane to the target | You touch the target (probes, scans, banners) |
| Cert transparency, DNS, OSINT, archives, GitHub, social | Port scans, web crawling, service banner grabs, DNS zone enumeration |
| Invisible to the target | Logged by the target |
| Cheap, slow | Faster, noisier |

Passive first. Always. Spend the front of the engagement understanding the target before a single probe.

---

## Passive recon

**External attack surface mapping**

- **Cert transparency** — `crt.sh`, `certspotter`, `subfinder`. Every cert ever issued for the domain shows up here. Best subdomain source.
- **Passive DNS** — SecurityTrails, RiskIQ/PassiveTotal, Farsight DNSDB. Historical resolution data.
- **DNS** — SOA, MX, TXT (SPF/DKIM/DMARC give away mail provider, sometimes more).
- **WHOIS / RDAP** — registrant, abuse contact, name servers, registration date.
- **BGP / ASN** — `bgp.he.net`, `bgpview.io`. Maps the org's IP allocations.
- **Shodan / Censys / Fofa / ZoomEye** — internet-wide scan data, banner-searchable.
- **Wayback Machine** — historical content, often surfaces deleted endpoints.
- **GitHub / GitLab / public package indexes** — leaked secrets, internal references, employee accounts.
- **LinkedIn / org charts** — employees, roles, technologies (job postings give away the stack).

**Tools to glue it together**

- `amass enum -passive` — broad subdomain enumeration from many sources.
- `subfinder` — fast subdomain discovery.
- `assetfinder`, `chaos-client` — adjacent.
- `gau`, `waybackurls` — historical URLs from web archives.
- `theHarvester` — emails, names, hosts from public sources.
- `trufflehog`, `gitleaks` — secrets in git history.

---

## Active recon

**Network**

- **[nmap](/wiki/tools/nmap/)** — the standard. Service version detection (`-sV`), default scripts (`-sC`), full port range (`-p-`).
- **`masscan` / `rustscan`** — fast initial sweep across large ranges, then nmap-deeper on the hits.
- **`naabu`** — modern fast port scanner from ProjectDiscovery.

**DNS**

- **`dnsenum`, `fierce`, `dnsx`** — bruteforce subdomains, zone transfers (`AXFR` is rare but worth trying once).

**Web**

- **`httpx`** — probe a list of hosts/URLs, fingerprint tech stack, get titles.
- **`whatweb` / `wappalyzer`** — tech-stack fingerprinting.
- **`ffuf` / `gobuster` / `feroxbuster`** — content discovery (directories, files, vhosts, parameters).
- **`nuclei`** — template-driven scanning for known vulns and misconfigurations.

**Active Directory (internal)**

- **`nxc` (NetExec, formerly crackmapexec)** — broad SMB/WinRM/MSRPC enumeration.
- **`ldapsearch` / `ldapdomaindump`** — directory enumeration.
- **BloodHound + SharpHound / RustHound / soaphound** — graph the AD trust relationships.
- **`rpcclient`, `enum4linux-ng`** — SMB enumeration over MSRPC.

---

## Scope discipline

In red-team mode, every active probe burns OPSEC budget. Plan it:

- Stage scans through redirectors and disposable IPs.
- Slow scans down to blend with normal traffic.
- Skip what's already in passive data — there's no reason to port-scan a host whose Shodan record is two days old.
- Match scan rate to the org's expected baseline. A 100,000 pps masscan from a cloud IP looks nothing like a normal probe.

In pentest mode, you can be louder, but still: don't `-T5` against fragile targets and then explain the outage.

---

## Output discipline

Whatever you discover, file it as you go. A good engagement notebook:

- A flat host inventory: IP / hostname / open ports / service / version / notes.
- A web-app inventory: URL / tech stack / interesting endpoints.
- A people inventory: name / role / email format / known accounts.
- A vuln inventory: candidate finding / evidence / status (unconfirmed / confirmed / exploited / reported).

Tools like `EyeWitness` (web screenshots), `Aquatone`, and `gowitness` are useful for visually triaging large web inventories.

---

## References

- *The Hacker Playbook 3* — Peter Kim
- *OSINT Techniques* — Michael Bazzell
- ProjectDiscovery tools — <https://github.com/projectdiscovery>
- HackTricks — <https://book.hacktricks.xyz/>
