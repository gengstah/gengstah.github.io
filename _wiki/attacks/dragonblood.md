---
title: "Dragonblood — Attacking WPA3's SAE / Dragonfly Handshake"
permalink: /wiki/attacks/dragonblood/
layout: single
author_profile: true
tags:
  - wifi
  - attack
  - wpa3
  - sae
  - dragonfly
  - eap-pwd
  - vanhoef
---

*Side-channel, downgrade, and DoS attacks against WPA3's SAE handshake — and against EAP-pwd. The first big break of WPA3, two years after the spec.*

**Status:** drafting
**Venue:** IEEE Symposium on Security & Privacy 2020 (preprint April 2019; conference talk Black Hat USA 2019)
**Authors:** Mathy Vanhoef (NYU Abu Dhabi / KU Leuven), Eyal Ronen (Tel Aviv University)
**Related:** [Wi-Fi Key Hierarchy](/wiki/concepts/wifi-key-hierarchy/), [WPA Versions](/wiki/concepts/wpa-versions/), [Handshakes](/wiki/concepts/handshakes/), [KRACK](/wiki/attacks/krack/), [FragAttacks](/wiki/attacks/fragattacks/)

---

## What it is

WPA3-Personal replaces WPA2's PSK-derived authentication with **SAE** (Simultaneous Authentication of Equals), built on the **Dragonfly** PAKE. SAE is supposed to provide:

1. Forward secrecy (a captured handshake cannot be cracked offline even if the password is later known).
2. Resistance to offline dictionary attacks (an attacker who eavesdrops the handshake learns *nothing* about the password).
3. Mutual authentication.

Dragonblood breaks all three by exploiting the **hash-to-curve** step that maps a password to a curve point: if implementations use the **hunting-and-pecking** method (as the WPA3 / EAP-pwd spec mandated), the loop's iteration count and execution path leak password-dependent information. Combined with caching side channels, this lets an attacker run an offline dictionary attack — defeating the whole point of SAE.

---

## The attack families

The paper documents several distinct attacks:

- **Cache-based side channel.** Hunting-and-pecking branches based on whether a generated point is on the curve. Through Flush+Reload or Prime+Probe on a co-located process (e.g., a malicious app on the victim's phone), the attacker learns which iterations succeeded. This is a *partial password partitioning oracle* — combined with the passwords the attacker is willing to test offline, the search space collapses to feasible.
- **Timing side channel.** Same leak, exploited remotely via the time-to-respond of the server. Requires more samples and is sensitive to network jitter, but viable on lab networks. Particularly effective against MODP groups 22, 23, 24.
- **Downgrade attacks.** WPA3 supports a *transition mode* where the same SSID accepts WPA2 and WPA3 connections. A rogue AP can advertise WPA2-only and force the client to fall back, exposing the connection to KRACK-class attacks. A second downgrade variant forces SAE to use a weak elliptic-curve group the attacker is comfortable with.
- **Denial-of-service.** SAE commit messages are computationally expensive on the AP side; an attacker can flood commit frames from random MACs to exhaust the AP. The spec's anti-clogging tokens are insufficient under heavy load.
- **EAP-pwd authentication bypass.** The same hash-to-curve flaw applies to EAP-pwd; combined with implementation bugs, several products allowed full authentication bypass.

---

## What changed

- **The Wi-Fi Alliance updated the spec** to mandate **SAE-PT (Hash-to-Element / "Hash-to-Curve simplified")** — a constant-time, branch-free password-to-point mapping that closes the side-channel hole. Dragonblood-resistant SAE.
- **Implementations patched** their hunting-and-pecking loops with constant-time variants and cache-line scrubbing.
- **Stronger MODP groups** were prioritized; weak groups (22, 23, 24) deprecated for SAE.

The 2020 paper's title was eventually revised to "*A Security Analysis of WPA3's SAE Handshake*" for the S&P version.

---

## Why it matters

Dragonblood is the first protocol-level break of WPA3, but it's also a textbook lesson in protocol design: a PAKE that's secure on paper can fail catastrophically when the hash-to-point primitive isn't constant-time. Every PAKE adoption since has explicitly required constant-time hashing.

The 2024 [SSID Confusion](/wiki/attacks/ssid-confusion/) attack and the 2026 [AirSnitch](/wiki/concepts/airsnitch-overview/) work both build on the same authorial line — the Vanhoef research program of treating the Wi-Fi standard itself as an attack surface.

---

## References

- Mathy Vanhoef, Eyal Ronen — *Dragonblood: A Security Analysis of WPA3's SAE Handshake* — IEEE S&P 2020 — <https://papers.mathyvanhoef.com/dragonblood.pdf>
- Project page — <https://wpa3.mathyvanhoef.com/>
- IACR ePrint 2019/383 — <https://eprint.iacr.org/2019/383>
- Black Hat USA 2019 whitepaper — <https://i.blackhat.com/USA-19/Wednesday/us-19-Vanhoef-Dragonblood-Attacking-The-Dragonfly-Handshake-Of-WPA3-wp.pdf>
