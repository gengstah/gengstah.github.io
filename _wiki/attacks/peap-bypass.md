---
title: "PEAP / IWD Authentication Bypass (CVE-2023-52160 / CVE-2023-52161)"
permalink: /wiki/attacks/peap-bypass/
layout: single
author_profile: true
tags:
  - wifi
  - attack
  - peap
  - eap
  - wpa-enterprise
  - iwd
  - wpa-supplicant
  - vanhoef
---

*Skipping inner-PEAP authentication on `wpa_supplicant` (Android default), and a separate handshake-state bug in Intel's IWD that lets an unauthenticated attacker join a protected network.*

**Status:** drafting
**Venue:** Top10VPN advisory + Vanhoef disclosures, February 2024
**Researcher:** Mathy Vanhoef (KU Leuven imec-DistriNet)
**CVEs:** CVE-2023-52160 (wpa_supplicant), CVE-2023-52161 (IWD)
**Related:** [WPA Versions](/wiki/concepts/wpa-versions/), [RADIUS](/wiki/concepts/radius/), [Handshakes](/wiki/concepts/handshakes/), [SSID Confusion](/wiki/attacks/ssid-confusion/), [Rogue AP](/wiki/attacks/rogue-ap/)

---

## CVE-2023-52160 — wpa_supplicant PEAP TLV-Success bypass

PEAP is a two-phase EAP method:

1. **Phase 1.** Outer TLS tunnel established between supplicant and AAA server (the supplicant authenticates the *server* via its certificate).
2. **Phase 2.** The supplicant authenticates *itself* to the server inside the TLS tunnel, typically via MSCHAPv2.

Phase-2 success is signalled by an **EAP-TLV Success** message inside the tunnel.

The bug: in `wpa_supplicant ≤ 2.10`, if the supplicant is configured to *not* verify the server certificate (no `ca_cert` set, or `ca_cert` mis-configured), the supplicant will accept an outer EAP-Success message that arrives *before* phase 2 starts at all. A rogue AP terminates the outer TLS, sends EAP-Success, and the supplicant believes it has authenticated.

Why this happens routinely on Android: the device's default supplicant is `wpa_supplicant`, and many enterprise Wi-Fi profiles are deployed without setting `ca_cert` (because configuring the CA correctly is hard at scale, especially for users joining via QR code or printed passphrases). Until the OS forces `ca_cert` to be required for PEAP networks, the bug is reachable.

---

## CVE-2023-52161 — IWD 4-way handshake state bypass

Intel's `IWD` (iNet Wireless Daemon) accepts a malformed sequence of 4-way handshake messages. An attacker who knows a valid SSID and the network's authentication mode (but **not** the PSK) can complete a handshake by reordering / replaying frames in a way IWD's state machine accepts as authenticated. The attacker joins the network without ever proving knowledge of the passphrase.

Affects IWD ≤ 2.13. Linux-only impact (IWD is mainly used on Linux, including some ChromeOS configurations).

---

## Exploitation

Both CVEs share the same outer shape: a rogue AP advertising the target SSID, mode, and BSSID.

For **CVE-2023-52160**: the attacker terminates the outer TLS (using a self-signed cert that the unverified supplicant accepts), sends an outer EAP-Success without phase-2, and is joined as the victim.

For **CVE-2023-52161**: the attacker performs a handshake with the victim's IWD instance, manipulating message ordering to land in an "authenticated" state without holding the PSK. The attacker now talks to the network as a legitimate STA.

---

## What stops it

- **wpa_supplicant ≥ 2.11** with the patch.
- **`ca_cert` mandatory** in PEAP profiles. Android 14+ enforces this; older Android configurations need manual repair.
- **Server certificate validation** — set `ca_cert` to the AAA server's CA, or pin the certificate via `domain_match` / `domain_suffix_match`.
- **IWD ≥ 2.14** with the state-machine fix.

---

## Why it matters

WPA-Enterprise was supposed to be the answer to PSK reuse: each user has their own credentials, and the network is much harder to phish. These two CVEs show that the *implementations* of WPA-Enterprise have multi-step state machines with footguns, and that operational practice (skipping certificate validation) makes bypassing them trivial. Pairs naturally with [SSID Confusion](/wiki/attacks/ssid-confusion/) and [Rogue AP](/wiki/attacks/rogue-ap/) attacks for full takeovers of enterprise Wi-Fi.

---

## References

- Top10VPN — *New WiFi Authentication Vulnerabilities Discovered* (Feb 2024) — <https://www.top10vpn.com/research/wifi-vulnerabilities/>
- The Hacker News — *New Wi-Fi Vulnerabilities Expose Android and Linux Devices to Hackers*
- SecurityWeek — *New Wi-Fi Authentication Bypass Flaws Expose Home, Enterprise Networks*
- CVE-2023-52160 / CVE-2023-52161 — NVD entries
