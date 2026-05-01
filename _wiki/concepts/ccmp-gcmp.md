---
title: "CCMP, GCMP, and the AES-Based Wi-Fi Ciphers"
permalink: /wiki/concepts/ccmp-gcmp/
layout: single
author_profile: true
tags:
  - wifi
  - concept
  - cipher
  - ccmp
  - gcmp
  - aes
---

*The AES-based AEAD modes that actually do the link-layer encryption on every modern Wi-Fi network. CCMP-128 is the WPA2 default; GCMP-256 is the WPA3-Enterprise-192 default. Same family, different trade-offs.*

**Status:** drafting
**Related:** [Wi-Fi key hierarchy](/wiki/concepts/wifi-key-hierarchy/), [RSN information element](/wiki/concepts/rsn-information-element/), [Handshakes](/wiki/concepts/handshakes/), [WEP](/wiki/concepts/wep/)

---

## CCMP — Counter Mode with CBC-MAC Protocol

The default WPA2 cipher (RFC 3610). AES-CCM is an AEAD construction:

- **Counter mode** for encryption: `ciphertext = plaintext ⊕ AES_CTR(K, nonce, counter)`.
- **CBC-MAC** for authentication: a chained AES-CBC computed over (nonce, AAD, plaintext) produces a MIC.

Per-frame parameters:

- **Key (TK)** — Temporal Key from the [PTK](/wiki/concepts/wifi-key-hierarchy/) (or GTK for broadcast).
- **Nonce** — 13 bytes: priority + sender MAC + 6-byte Packet Number (PN). PN must be unique per (key, sender).
- **AAD** (Additional Authentication Data) — selected MAC-header fields *that must not be modified*.

PN starts at 1 after install; replays are detected by tracking a per-key replay window.

CCMP-128 means a 128-bit key, 128-bit MIC. CCMP-256 (rare in Wi-Fi 4/5; available in WPA3-Enterprise) uses a 256-bit key.

## GCMP — Galois/Counter Mode Protocol

WPA3-Enterprise-192 default; optional in earlier modes.

- **Counter mode** for encryption (same as CCMP).
- **GHASH** (Galois-field MAC) for authentication.

GCMP is faster than CCMP at high data rates because GHASH is more parallelisable on AES-NI hardware. Same nonce / PN structure as CCMP.

GCMP-128 and GCMP-256 are both specified; WPA3-Enterprise-192 mandates GCMP-256.

## Why nonce reuse is fatal

For both CCMP and GCMP — and for any counter-mode cipher — **reusing a nonce under the same key catastrophically breaks confidentiality**. Two ciphertexts under the same key+nonce XOR to plaintext^plaintext. For GCMP it's worse: nonce reuse leaks the GHASH key, breaking integrity entirely (an attacker can forge arbitrary frames).

This is exactly the failure mode [KRACK](/wiki/attacks/krack/) induced. By replaying message 3 of the 4-way handshake, KRACK forced the receiver to **reinstall** the PTK, resetting the PN counter to zero. Subsequent unicast frames repeated nonces; for GCMP networks, an attacker recovered the GHASH authentication key and forged frames.

## What gets MIC'd

CCMP / GCMP MIC AAD includes:

- Frame Control (with some bits masked — sequence-control and retry bits are not included).
- Address 1 / 2 / 3.
- Sequence Control (with retry bit cleared).
- Optionally Address 4, QoS Control, HT Control.

What's notably *not* protected:

- Frame Control's `Power Management` bit ([Framing Frames](/wiki/attacks/framing-frames/) surface).
- Pre-WPA3-2020: the `A-MSDU Present` bit in QoS Control was not in AAD ([FragAttacks](/wiki/attacks/fragattacks/) surface).

## BIP — for management frames

[MFP](/wiki/concepts/mfp/) protects (some) management frames using **BIP** (Broadcast/Multicast Integrity Protocol):

- **BIP-CMAC-128** — default. AES-CMAC over the management frame.
- **BIP-CMAC-256** / **BIP-GMAC-128** / **BIP-GMAC-256** — stronger variants.

BIP only **authenticates** management frames; it does not encrypt them. The IGTK is the BIP key.

## Per-PN replay protection

Each receiver maintains a replay window for each PN counter it cares about (one for unicast PTK, one for GTK, one for IGTK). Modern stacks use a sliding 64-element window; out-of-window or duplicate frames are dropped.

KRACK attacked exactly this state: a successful key reinstallation reset the receiver's window to 0, so retransmitted captured frames were accepted as fresh.

## Cipher negotiation and downgrade

The pairwise cipher and group cipher are independently negotiated via the [RSN IE](/wiki/concepts/rsn-information-element/). Mixed-mode (TKIP + CCMP) was a downgrade risk in WPA2's first decade; modern deployments use CCMP-only or CCMP+GCMP. WPA3 transition mode adds SAE/PSK negotiation but cipher remains CCMP-128 unless explicitly upgraded.

## Tooling

- `tshark -V` decodes per-frame CCMP / GCMP fields.
- `airdecap-ng` decrypts a capture given the key (PSK + handshake or PMK).
- `wpa_supplicant`'s `KEY_MGMT=` and `pairwise=` set what client-side will accept.
- `hostapd.conf`'s `wpa_pairwise=`, `rsn_pairwise=`, `group_cipher=`.

## See also

- [Wi-Fi key hierarchy](/wiki/concepts/wifi-key-hierarchy/) — TK is the cipher input.
- [RSN information element](/wiki/concepts/rsn-information-element/) — cipher negotiation.
- [KRACK](/wiki/attacks/krack/), [FragAttacks](/wiki/attacks/fragattacks/) — what AEAD-implementation bugs allow.

## References

- RFC 3610 — *Counter with CBC-MAC (CCM)*.
- IEEE 802.11-2020 §12.5 (CCMP), §12.5.5 (GCMP), §12.6 (BIP).
- Vanhoef + Piessens — *Predicting and Abusing WPA2/802.11 Group Keys* — USENIX Security 2016 — earlier nonce-reuse work.
