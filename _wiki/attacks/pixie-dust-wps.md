---
title: "Pixie Dust — Offline WPS PIN Recovery"
permalink: /wiki/attacks/pixie-dust-wps/
layout: single
author_profile: true
tags:
  - wifi
  - attack
  - wps
  - prng
  - bongard
---

*An offline brute-force of the WPS PIN, exploiting weak PRNGs in many AP chipsets to recover the secret nonces (E-S1, E-S2) — and thus the PSK — in seconds.*

**Status:** drafting
**Venue:** Hack.lu 2014
**Researcher:** Dominique Bongard (0xcite)
**Related:** [WPA Versions](/wiki/concepts/wpa-versions/), [Handshakes](/wiki/concepts/handshakes/)

---

## What it is

Wi-Fi Protected Setup (WPS) was supposed to make Wi-Fi onboarding easy: enter an 8-digit PIN, the AP transfers the PSK. The protocol involves an exchange where the AP commits to two secret nonces (E-S1, E-S2) and later reveals enough hashed material that the requester (legitimately) can derive the PIN.

The attack premise: those nonces are supposed to be generated from a cryptographic PRNG. **They're not, on many chipsets** — Ralink, Realtek, Broadcom variants used PRNGs that were either deterministic (LCG with a known seed in some cases) or extremely weak.

If the nonces are predictable, an attacker captures one WPS exchange (an active probe — about three seconds of interaction with the AP), then runs an *offline* brute force over the PRNG state space to recover E-S1, E-S2, and from them the 8-digit PIN. The PIN reveals the PSK.

This collapses WPS PIN recovery from "11,000 online attempts at 1-2/sec" (the prior **Reaver** online brute force, often hours-to-days) down to seconds-to-minutes offline against a vulnerable router.

---

## Why it works

- **Weak PRNG choices** at chip-design time. The vulnerable chipsets used predictable seeds (often the device's startup time, or zero) and short LCGs.
- **WPS is on by default** on most consumer routers from the era, and in many cases cannot be disabled via the web UI even when the user thinks they have done so.
- **No rate-limit standard** — even when AP-side WPS lockout exists, the attack is *offline*: the attacker only needs one WPS message exchange to start the brute force.

---

## Tooling

- **pixiewps** — the offline brute-force implementation — <https://github.com/wiire-a/pixiewps>
- Used together with **Reaver** (active probe) and **bully** for full one-tool workflow.
- Modern routers running OpenWrt / vendor-patched firmware ship with strong PRNG seeds and (often) WPS disabled by default.

---

## What stops it

- **Disable WPS** on the AP. (The only complete fix.)
- **Update firmware** to a version with a fixed PRNG.
- **Rate-limit / lockout** WPS attempts on the AP — slows online attacks (Reaver) but doesn't stop Pixie Dust.

---

## Why this still matters in 2026

Pixie Dust is from 2014, but it remains the example everyone reaches for when explaining *why constant-time hashing and strong PRNGs are mandatory in cryptographic protocol design*. WPS is also still on by default on a depressing fraction of consumer hardware — periodic surveys still find Pixie-Dust-vulnerable routers in the wild. It's the cheapest single-tool break of consumer Wi-Fi when the tool fits.

---

## References

- Dominique Bongard — *Offline brute-force attack on WiFi Protected Setup* — Hack.lu 2014 — <http://archive.hack.lu/2014/Hacklu2014_offline_bruteforce_attack_on_wps.pdf>
- pixiewps — <https://github.com/wiire-a/pixiewps>
- Project FAQ — <https://github.com/wiire-a/pixiewps/wiki/FAQ>
