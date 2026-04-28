---
title: WPA Versions and Modes
permalink: /wiki/airsnitch/concepts/wpa-versions/
layout: single
author_profile: true
tags:
- airsnitch
- wifi
- concept
sources:
- ndss2026-paper
- airsnitch-readme
updated: 2026-04-28
---

Which WPA mode you run determines which AirSnitch attacks work and which don't. Summary up front:

| Mode | Machine-on-the-side | Rogue AP | Abusing GTK | Gateway Bouncing | Port Stealing | Broadcast Reflection |
| --- | --- | --- | --- | --- | --- | --- |
| WPA2-Personal (PSK) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| WPA3-Personal (SAE) | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| WPA2-Enterprise | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| WPA3-Enterprise | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| WPA3-PK (Public Key) | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |

(Synthesised from NDSS'26 Table VI and §IV-A.)

The headline: **switching from WPA2 to WPA3 only blocks two of the eight attacks.** Five attacks work against every encrypted mode. (README §1.)

## WPA2-Personal (WPA2-PSK)

Single shared passphrase. PMK = `PBKDF2(passphrase, SSID)`. Identical for every client.

- **Most exposed mode.** Any insider with the passphrase can derive any other client's PTK by sniffing their EAPOL frames → [machine-on-the-side](/wiki/airsnitch/attacks/machine-on-the-side/).
- Forced re-handshake via spoofed deauth (no MFP).

This is what most home Wi-Fi runs.

## WPA3-Personal (WPA3-SAE)

Same shared passphrase, but the PMK is established via the [Dragonfly handshake](https://datatracker.ietf.org/doc/html/rfc7664). Each session derives a unique PMK with forward secrecy. Passive PMK derivation by another client is not feasible.

- Defeats machine-on-the-side.
- Does **not** defeat [rogue AP](/wiki/airsnitch/attacks/rogue-ap/), because anyone with the passphrase can stand up a clone.
- Mandatory MFP raises the bar for forced re-handshake but does not prevent rogue-AP induction (channel-switch beacon trick still works).

## WPA2-Enterprise / WPA3-Enterprise

Per-user credentials authenticated against a [RADIUS server](/wiki/airsnitch/concepts/radius/) using one of the EAP methods (PEAP-MSCHAPv2, EAP-TLS, EAP-TTLS). The PMK is derived from the EAP MSK, unique per session, never derivable from another client's traffic.

- Defeats machine-on-the-side.
- Defeats rogue AP **if** the EAP method authenticates the *server* (e.g. EAP-TLS with proper CA pinning, or PEAP/TTLS configured to verify the RADIUS cert). Misconfigured clients can still be tricked by a rogue AP advertising the same SSID. See [PEAP / EAP misconfiguration](/wiki/airsnitch/concepts/peap-misconfig/) *(planned)*.
- Does **not** defeat any of the L3/switching attacks. The AirSnitch authors leak WPA2-Enterprise traffic in plaintext on a real university network (NDSS'26 §VII-F).

The home-router lesson: turning on a RADIUS server (often built into the router) gets you out of the worst exposure of WPA2-PSK.

## WPA3-PK (WPA3 Public Key)

Variant of SAE where the shared "passphrase" is actually derived from a **public key**. The corresponding private key lives on the AP. An attacker who only has the passphrase cannot stand up a rogue AP that the client will trust, because the client will reject the handshake without the private key.

- Defeats rogue AP under WPA3.
- Same caveats as the rest: doesn't help against L3/switching attacks.

## Mode-independent attacks

Five of AirSnitch's attacks **don't care which encryption you use**:

| Attack | Why it's mode-independent |
| --- | --- |
| [Abusing GTK](/wiki/airsnitch/attacks/abusing-gtk/) | GTK is shared in every WPA mode by default; the attack requires association, not a specific cipher |
| [Gateway Bouncing](/wiki/airsnitch/attacks/gateway-bouncing/) | Pure L3 attack; encryption is terminated at the AP |
| [Port Stealing](/wiki/airsnitch/attacks/port-stealing/) | Exploits the AP's bridge FDB after decryption |
| [Broadcast Reflection](/wiki/airsnitch/attacks/broadcast-reflection/) | Exploits the AP's broadcast-handling logic after decryption |
| [Inter-NIC relaying / port-restoration helpers](/wiki/airsnitch/attacks/auxiliary-techniques/) | Pure switching/forwarding manipulation |

## TKIP, CCMP, GCMP

Cipher suites under WPA. AirSnitch is independent of cipher choice: it does not break the cipher. CCMP-128 (default for WPA2) and GCMP-256 (WPA3) both terminate at the AP, where AirSnitch attacks the layer above (NDSS'26 §IV introduction).

WEP is still considered: the artifact appendix demonstrates exploits work even when the AP runs WEP, mostly to show that "switch to a stronger cipher" is the wrong fix. (README §1, "These attacks bypass Wi-Fi encryption, meaning that simply using WPA1/2/3 does not, on its own, prevent these attacks.")

## See also

- [Wi-Fi key hierarchy](/wiki/airsnitch/concepts/wifi-key-hierarchy/)
- [Machine-on-the-side](/wiki/airsnitch/attacks/machine-on-the-side/), [Rogue AP](/wiki/airsnitch/attacks/rogue-ap/)
- [RADIUS](/wiki/airsnitch/concepts/radius/)
- [Configuration files](/wiki/airsnitch/tools/configurations/) for AirSnitch's `client.conf`, `eap.conf`, `multipsk.conf`, `saepk.conf`.
