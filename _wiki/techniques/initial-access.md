---
title: "Initial Access"
permalink: /wiki/techniques/initial-access/
layout: single
author_profile: true
tags:
  - red-team
  - pentest
---

*Getting the first foothold inside the perimeter.*

**Status:** seed
**Related:** [Reconnaissance](/wiki/techniques/recon/), [Red Teaming](/wiki/domains/red-teaming/), [OPSEC](/wiki/concepts/opsec/), [Persistence](/wiki/techniques/persistence/), [Privilege Escalation](/wiki/techniques/privilege-escalation/)

{% include toc %}

---

## Categories

ATT&CK groups initial access (TA0001) into a handful of categories — the practical paths haven't changed much in years:

- **Phishing** — by far the most common. Attachment, link, OAuth consent.
- **Exploit a public-facing application** — exposed services with known or 0-day bugs.
- **Valid accounts** — credentials from leaks, password sprays, MFA fatigue.
- **External remote services** — VPN, RDP, Citrix, mail OWA without MFA.
- **Supply chain** — software dependency, hardware, vendor account.
- **Trusted relationship** — partner / IT-provider account.
- **Hardware additions** — USB drop, implant.

Most red-team operations succeed through phishing or valid-account abuse. Most catastrophic intrusions start through a public-facing exploit.

---

## Phishing

The dominant initial-access vector. Modern variants:

- **Attachment-based** — Office macro, OneNote `.one` (post-Office macro restrictions, briefly hot, now mostly dead), HTML smuggling, ISO/IMG/VHD container, LNK with embedded payload, ClickOnce.
- **Link-based** — credential harvesting (Evilginx2-style adversary-in-the-middle, defeats most MFA), browser-in-the-browser overlays, drive-by exploit on a malicious site.
- **OAuth consent** — Microsoft 365 illicit consent grant. Victim grants an attacker app full Graph API access. No password stolen, no MFA bypassed — they consented.
- **MFA fatigue / push bombing** — repeatedly trigger push prompts until the victim approves one.
- **Vishing** — phone-call follow-up (Scattered Spider's signature). Combine with help-desk impersonation to reset MFA.

Defense moves the field constantly. Office blocks macros from internet. Containers (ISO, VHD) get marked-of-the-web tagged. SmartScreen and AppLocker tighten. Operator response: rotate to whatever the org *doesn't* block this quarter.

---

## Public-facing exploitation

When initial access comes through a CVE, the categories cluster:

- **Edge VPN / SSL-VPN appliances** — Pulse, Fortinet, Citrix, Ivanti, Cisco. Long history of catastrophic pre-auth RCEs.
- **Mail / collaboration servers** — Exchange (ProxyLogon, ProxyShell, ProxyNotShell), Confluence, Jira, GitLab, Bitbucket.
- **Application servers** — Log4j-class deserialization in Java middleware; Jenkins; Spring.
- **File-transfer products** — MOVEit, GoAnywhere, Accellion. Single-CVE data-theft sprees.
- **Remote-management tooling** — ScreenConnect, ConnectWise, AnyDesk, PRTG.

The pattern: *internet-exposed admin interface + once-popular product + a few years of underinvestment*. Hunt these on the target's perimeter.

---

## Valid accounts

Often the easiest way in:

- **Credential leaks** — combolists from prior breaches. `dehashed`, `intelx`, `leakcheck`. Credential reuse remains rampant.
- **Password spray** — one common password against many accounts (the inverse of a brute-force; rate-limit-friendly).
- **AS-REP roasting / Kerberoasting** — only works post-foothold but listed here because the offline crack feeds back into "valid account" attacks.
- **Stolen tokens / cookies** — infostealer market. Buy a session cookie that bypasses MFA entirely.

For targeting, modern enterprise auth is OAuth/OIDC against an IdP (Entra ID, Okta, Google Workspace). Bypass MFA via AiTM (Evilginx2, EvilProxy), token theft, or convincing the victim to MFA-approve.

---

## Sandbox-aware payload design

Even after delivery, your payload still has to *run* in a hostile environment:

- **AV / EDR evasion** — encrypted payload + just-in-time decryption; syscall-based loaders that bypass user-mode hooks; indirect syscalls.
- **Sandbox detection** — short execution windows, no user input, virtualized hardware. Skip-on-sandbox is standard.
- **Conditional execution** — only run on the target tenant / domain / username. Reduces collateral and false-positive analysis.
- **Living off the land** — `rundll32`, `regsvr32`, `mshta`, `wscript`, `installutil`. Less detected per-binary; heavily monitored as a class.

---

## Practical defaults (red team)

A typical 2026 red-team initial-access plan looks something like:

1. **Recon** — enumerate the org's mail/calendar provider, AS, EDR/AV via job posts, public domains.
2. **Pretext** — IT, HR, or vendor impersonation tied to a real-looking event.
3. **Delivery** — Evilginx2 AiTM phish for MFA capture, *or* HTML smuggling → ISO container → LNK → loader if you want a beacon, *or* OAuth consent for the org that uses M365.
4. **Beacon profile** — fronted CDN, long jitter, sleep-mask enabled.
5. **First action** — sleep. Don't fire `whoami` instantly; let the host settle and observe baseline before doing anything that generates telemetry.

---

## References

- MITRE ATT&CK TA0001 — <https://attack.mitre.org/tactics/TA0001/>
- *Phishing Dark Waters* — Hadnagy & Fincher
- Evilginx2 — <https://github.com/kgretzky/evilginx2>
- HTML smuggling research — Outflank, MDSec
- CISA Joint Advisories on initial-access vectors (Volt Typhoon, Scattered Spider, etc.)
