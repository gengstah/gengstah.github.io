---
title: "SAE — Simultaneous Authentication of Equals (Dragonfly)"
permalink: /wiki/concepts/sae-dragonfly/
layout: single
author_profile: true
tags:
  - wifi
  - concept
  - sae
  - wpa3
  - dragonfly
---

*The PAKE handshake that replaces WPA2-PSK in WPA3-Personal. Forward-secret, dictionary-attack-resistant — and the historic source of the Dragonblood family of side-channel attacks.*

**Status:** drafting
**Related:** [WPA versions](/wiki/concepts/wpa-versions/), [Authentication and association](/wiki/concepts/authentication-association/), [Wi-Fi key hierarchy](/wiki/concepts/wifi-key-hierarchy/), [Dragonblood](/wiki/attacks/dragonblood/), [EAP-PWD](/wiki/concepts/eap-pwd/)

---

## What SAE solves

WPA2-PSK derives the PMK as `PBKDF2(passphrase, SSID)` — the **same** for every client. Anyone with the passphrase can derive any other client's PTK after passively capturing their 4-way handshake. No forward secrecy. Offline dictionary attack on a captured handshake.

SAE replaces the PSK→PMK derivation with a balanced password-authenticated key exchange. After SAE:

- Each session derives a **fresh PMK** that an observer cannot compute from the passphrase alone.
- An attacker with the passphrase cannot derive a peer's PMK from passive observation. (Active impersonation — [rogue AP](/wiki/attacks/rogue-ap/) — still works because anyone with the passphrase can run an AP.)
- Forward secrecy: compromise of the passphrase does not retroactively decrypt past sessions.
- Offline dictionary attack on a captured exchange is *not* feasible — verification requires running another live handshake against the AP, rate-limited.

## The handshake

Two phases, **Commit** and **Confirm**, exchanged inside Authentication frames (algorithm number 3):

```
STA               AP
 │                │
 │── Commit (sc, E) ──►        sc = scalar; E = group element
 │  ◄── Commit (sc', E') ──    Both derived from password + nonces
 │                │
 │── Confirm (MIC) ──►          MIC over the transcript using the PMK
 │  ◄── Confirm (MIC) ──        Both sides verify
 │                │
 │       PMK installed
```

After confirm, the regular [4-way handshake](/wiki/concepts/handshakes/) runs to install PTK / GTK as usual.

## Hunting-and-pecking

The **password-to-element** step turns the passphrase into a curve point that both peers can independently compute. The original draft used **hunting and pecking**:

```
i = 1
while i < 40:
    seed = HKDF(password, "SAE Hunting and Pecking", i, MAC1, MAC2)
    x = first n bits of seed mod p
    if y² = x³ + ax + b has a solution mod p:
        return (x, y)
    i += 1
```

The variable iteration count is the cache-timing leak that [Dragonblood](/wiki/attacks/dragonblood/) exploits.

## Hash-to-Curve (the fix)

WPA3-2020 mandates **Hash-to-Curve** (RFC 9380's Simplified SWU map for short-Weierstrass curves, or Elligator-2 for Curve25519 / X448) instead. The map is *constant-time* in the input — same number of operations regardless of password — eliminating the side channel.

Adoption: hostapd, wpa_supplicant, and most Wi-Fi 6E and Wi-Fi 7 chipsets ship the Hash-to-Curve variant by default. WPA3-2018 deployments may still use hunting-and-pecking; "WPA3 Certified Release 2" requires Hash-to-Curve.

## SAE-PK (Public Key)

A WPA3 variant where the "passphrase" is derived from a **public key** that the AP advertises. The corresponding private key lives on the AP. An attacker who has only the passphrase cannot stand up a rogue AP that the client will trust, because the client validates the AP's signature during SAE.

This is the only WPA3-Personal variant that defeats [rogue AP](/wiki/attacks/rogue-ap/). Adoption is rare as of 2026.

## Anti-clogging

SAE is computationally intensive (curve operations on every Commit). To resist DoS, APs use an **anti-clogging cookie**: when the AP is busy, it replies to the first Commit with a token; the STA must echo the token in a follow-up Commit. The AP only does the expensive work for echoing STAs.

Older anti-clogging implementations had bugs (Dragonblood's downgrade dance exploited inconsistent token validation), now fixed.

## Group negotiation and downgrade

SAE supports multiple cryptographic groups (default: NIST P-256, but P-384, P-521, Curve25519 are options). The client offers groups in preference order; the AP picks. Pre-Dragonblood, an attacker MITM could rewrite the offer to force a weak group. The fix:

- AP and STA cache the negotiated group and reject downgrades on subsequent associations (RFC 7664 §13 amendment).
- Modern wpa_supplicant pins the previously-used group per BSS.

## Transition mode (WPA3-Personal Transition)

A transition-mode SSID accepts both WPA2-PSK and WPA3-SAE clients. The AP advertises both AKMs in the RSN IE; legacy clients fall back to PSK while modern clients use SAE.

**Offensive implication.** A WPA3-Personal-Transition SSID is *not* WPA3-equivalent for legacy clients. They still use PSK and remain vulnerable to machine-on-the-side. WPA3-only mode is the secure deployment.

## Tooling

- `hostapd.conf` — `wpa_key_mgmt=SAE` (WPA3-only) or `WPA-PSK SAE` (transition).
- `wpa_cli`'s `add_network` with `key_mgmt=SAE` and `psk="..."` for client-side.
- `dragonblood-tools` — research-grade side-channel exploitation against pre-Hash-to-Curve hostapd.

## See also

- [WPA versions](/wiki/concepts/wpa-versions/) — WPA3-Personal context.
- [Wi-Fi key hierarchy](/wiki/concepts/wifi-key-hierarchy/) — where SAE's PMK fits.
- [Dragonblood](/wiki/attacks/dragonblood/), [EAP-PWD](/wiki/concepts/eap-pwd/).

## References

- RFC 7664 — *Dragonfly Key Exchange*.
- IEEE 802.11-2020 §12.4 (SAE).
- Vanhoef + Ronen — *Dragonblood* — IEEE S&P 2020.
- RFC 9380 — *Hashing to Elliptic Curves*.
