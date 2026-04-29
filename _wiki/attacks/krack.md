---
title: "KRACK — Key Reinstallation Attacks on WPA2"
permalink: /wiki/attacks/krack/
layout: single
author_profile: true
tags:
  - wifi
  - attack
  - wpa2
  - handshake
  - nonce-reuse
  - vanhoef
---

*Forcing nonce reuse in the WPA2 4-way handshake by replaying message 3 — the bug that broke Wi-Fi encryption in 2017.*

**Status:** drafting
**Venue:** ACM CCS 2017
**Authors:** Mathy Vanhoef, Frank Piessens (KU Leuven)
**Related:** [Wi-Fi Key Hierarchy](/wiki/concepts/wifi-key-hierarchy/), [Handshakes](/wiki/concepts/handshakes/), [WPA Versions](/wiki/concepts/wpa-versions/), [FragAttacks](/wiki/attacks/fragattacks/), [Framing Frames](/wiki/attacks/framing-frames/)

---

## What it is

In the WPA/WPA2 4-way handshake, the supplicant installs the PTK and starts a fresh per-key nonce/replay counter when it receives **message 3**. The standard requires retransmission of M3 if M4 is lost — and on retransmission the supplicant *re-installs* the same key, resetting the nonce/replay counter to its starting value. KRACK abuses that retransmission: an attacker in a man-in-the-middle position blocks M4 from reaching the AP, forces the AP (or, in some attacks, the supplicant itself) to retransmit M3, and the supplicant re-installs the same PTK — producing **nonce reuse** under the same key.

Nonce reuse breaks the security guarantees of every WPA2 encryption mode:

- **CCMP (AES-CCM)** — leaks plaintext via XOR of ciphertexts that share a key/nonce; replay defenses break.
- **TKIP** — leaks the per-packet MIC key (forgery becomes trivial — far worse than just confidentiality loss).
- **GCMP (WiGig / 802.11ad)** — leaks the GHASH authentication key → forgery in *both* directions.

The attack also applies to the **group key handshake**, the **FT (Fast BSS Transition) handshake**, the **PeerKey handshake**, the **TDLS handshake**, and the **WNM Sleep Mode** response — all of which install a key.

A particularly clean variant against Linux/Android pre-Aug-2017 forced the supplicant to install an *all-zero* key, because of how `wpa_supplicant` cleared the temporal key from memory after first installation.

---

## Why it works

The IEEE 802.11 standard never explicitly forbade re-installing the same key. The standard also did not restrict when a supplicant should accept message 3 — so an attacker could replay it. The combination is fatal. Patches add a "we already installed this key" check to refuse the re-installation, and tighten message-3 acceptance windows.

---

## CVE cluster

KRACK was assigned ten CVEs:

- CVE-2017-13077 — reinstallation of PTK in 4-way handshake
- CVE-2017-13078 — reinstallation of GTK in 4-way handshake
- CVE-2017-13079 — reinstallation of IGTK in 4-way handshake
- CVE-2017-13080 — reinstallation of GTK in group-key handshake
- CVE-2017-13081 — reinstallation of IGTK in group-key handshake
- CVE-2017-13082 — accept/reinstall PTK in retransmitted FT Reassociation Request
- CVE-2017-13084 — reinstallation of STK in PeerKey handshake
- CVE-2017-13086 — reinstallation of TPK in TDLS handshake
- CVE-2017-13087 — reinstallation of GTK while processing WNM Sleep Mode Response
- CVE-2017-13088 — reinstallation of IGTK while processing WNM Sleep Mode Response

---

## What stops it

- **Updated supplicant/AP firmware** — refuse to re-install the same key; restrict message-3 acceptance.
- **Switch from TKIP/GCMP to CCMP-only** for partial mitigation — CCMP leakage is "only" plaintext loss; TKIP/GCMP leak forgery keys.
- **Doesn't break the PSK or the encryption primitives** — passphrase rotation is not required.
- **WPA3 (SAE)** — doesn't fix KRACK directly, but mandates Management Frame Protection and replaces PSK-derivation with SAE; the protocol surface is different.

---

## References

- Mathy Vanhoef, Frank Piessens — *Key Reinstallation Attacks: Forcing Nonce Reuse in WPA2* — ACM CCS 2017 — <https://papers.mathyvanhoef.com/ccs2017.pdf>
- Project page — <https://www.krackattacks.com/>
- ACM DOI — <https://dl.acm.org/doi/10.1145/3133956.3134027>
