---
title: "WEP (Wired Equivalent Privacy)"
permalink: /wiki/concepts/wep/
layout: single
author_profile: true
tags:
  - wifi
  - concept
  - wep
  - legacy
---

*The original 802.11 link-layer encryption — broken since 2001, deprecated, but still found on legacy industrial / IoT / municipal hardware. Useful as the historical anchor for understanding what every subsequent design fixed.*

**Status:** drafting
**Related:** [WPA versions](/wiki/concepts/wpa-versions/), [WPS](/wiki/concepts/wps/), [Handshakes](/wiki/concepts/handshakes/)

---

## What WEP is

A 40-bit (later 104-bit) shared-key stream cipher mode using **RC4** for confidentiality and **CRC-32** for integrity. The single network-wide key was concatenated with a 24-bit per-frame Initialisation Vector to form the 64- or 128-bit RC4 seed:

```
RC4 keystream = RC4( IV || K )
ciphertext   = plaintext ⊕ keystream
ICV          = CRC32(plaintext)
on-air       = IV (4 bytes) || ciphertext || ICV (4 bytes)
```

The IV was sent in cleartext. The CRC was meant to detect tampering.

## Why every part of WEP is broken

- **Linear ICV.** CRC-32 is linear over XOR. An attacker who flips bit `i` of the ciphertext can compute the matching change to the ICV and produce a frame that decrypts to a controlled modification of the plaintext. Bit-flipping at will.
- **24-bit IV space.** ~16M IVs. A busy AP repeats IVs every few hours; two ciphertexts under the same IV+K xor to plaintext^plaintext. Known-plaintext attacks recover key streams.
- **RC4 weak-key class.** Fluhrer, Mantin, Shamir (FMS, 2001) showed that for IVs of the form `(B+3, 0xFF, X)` the first byte of the keystream leaks the K's first byte. KoreK (2004) generalised; PTW (Pyshkin–Tews–Weinmann, 2007) reduced the data needed to ~40,000 packets.
- **No key management.** A single shared key, rotated by hand. Every employee who knew the key could decrypt every other employee's traffic.

The combination — known IV, weak first-byte keystream leak, malleable ICV — means a WEP key falls in **minutes** of passive capture (or seconds with active ARP-replay reinjection).

## Tooling

- `aireplay-ng -3` ARP-replay attack — accelerates IV harvesting.
- `aircrack-ng -K capture.cap` runs FMS / KoreK / PTW.
- `wesside-ng` is a one-shot WEP cracker; `airodump-ng` collects the data.

A WEP network drops in 5–15 minutes against a moderately busy AP.

## Why WEP still appears in 2026

- **Industrial / SCADA** kit installed before 2010 that doesn't speak WPA.
- **Municipal infrastructure** — traffic-light controllers, parking meters, sign-board controllers.
- **Old IoT** — printers, projectors, and IP cameras that shipped WEP-only firmware.
- **Misconfigured "compatibility" mode** — some APs let admins enable WEP for "legacy device support".

Vanhoef + Piessens, in the FragAttacks artifact appendix, even demonstrated their WPA-era attacks work over a WEP link, illustrating that "switch to a stronger cipher" is *not* the right framing for the layered weaknesses they exposed. WEP is just the bottom of the cliff.

## Operational notes

- An open WEP key is a **proximity-authentication failure**: anyone within range, after passive capture, has root-on-the-wire equivalent.
- Bridging WEP to a modern WPA3 network does not lift WEP's plaintext — the AP-side decryption recovers cleartext, and the wired bridge port carries it in the clear.
- Replacing WEP on a deployed fleet usually requires replacing the *radios*, not just the credentials. This is the actual reason WEP persists.

## See also

- [WPA versions](/wiki/concepts/wpa-versions/) — what replaced WEP.
- [Handshakes](/wiki/concepts/handshakes/) — the 4-way handshake is the proper key-management WEP lacked.
- [WPS](/wiki/concepts/wps/) — the consumer-grade replacement that introduced its own weaknesses.

## References

- Fluhrer, Mantin, Shamir — *Weaknesses in the Key Scheduling Algorithm of RC4* — Selected Areas in Cryptography 2001.
- Pyshkin, Tews, Weinmann — *Breaking 104 bit WEP in less than 60 seconds* — WISA 2007.
- Borisov, Goldberg, Wagner — *Intercepting Mobile Communications: The Insecurity of 802.11* — MobiCom 2001.
