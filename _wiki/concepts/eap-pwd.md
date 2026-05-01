---
title: "EAP-PWD"
permalink: /wiki/concepts/eap-pwd/
layout: single
author_profile: true
tags:
  - wifi
  - concept
  - eap
  - eap-pwd
  - dragonfly
---

*A password-based EAP method that uses the same Dragonfly hash-to-curve construction as WPA3-SAE — and thus inherits the [Dragonblood](/wiki/attacks/dragonblood/) cache and timing side channels.*

**Status:** drafting
**Related:** [EAP framework](/wiki/concepts/eap-framework/), [SAE / Dragonfly](/wiki/concepts/sae-dragonfly/), [Dragonblood](/wiki/attacks/dragonblood/)

---

## What it is

RFC 5931. A zero-knowledge password-authenticated key exchange (PAKE) for EAP. The peers prove knowledge of a shared password without revealing it; an active or passive attacker should not be able to learn the password from observed traffic alone.

EAP-PWD uses the **Dragonfly** key exchange — the same primitive as WPA3-SAE. Both call the password-to-element step **hunting and pecking**: iterate Y² = X³ + aX + b for trial X values until a curve point is found.

This is exactly the construction Vanhoef + Ronen attacked in [Dragonblood](/wiki/attacks/dragonblood/).

## Why offence cares

EAP-PWD is the only widely deployed Enterprise EAP method that doesn't ride on TLS. That's a *feature* — no PKI, no cert validation drama — and a *risk*, because the password protocol stands alone.

Side-channel attacks Vanhoef + Ronen demonstrated against EAP-PWD:

- **Cache attacks** on hostapd / wpa_supplicant's hunting-and-pecking: a co-resident attacker (e.g. on a shared FreeRADIUS server) observes which trial iterations cache-hit / -miss and learns information about the password hash.
- **Timing leakage** on chipsets that don't constant-time the password-to-element step.

Once a side channel narrows the candidate space, a dictionary attack finishes.

## Adoption

EAP-PWD has had niche deployment — research / academic environments, some federated networks, a handful of vendor implementations (FreeRADIUS, hostapd, some Cisco). It is **not** a default in mainstream Enterprise Wi-Fi.

WPA3-SAE incorporated the lessons: WPA3-2020 mandates the **Hash-to-Curve (RFC 9380)** alternative to hunting-and-pecking, eliminating the side-channel entirely. EAP-PWD has not been similarly rev'd in widespread deployment.

## When it shows up

Where you'll see EAP-PWD:

- Eduroam / academic federations alongside PEAP / EAP-TTLS.
- Hostapd / wpa_supplicant default builds (`CONFIG_EAP_PWD=y`).
- Some embedded Wi-Fi stacks where TLS state machines were too heavy.

If you encounter it during a Wi-Fi engagement, treat it like SAE for purposes of attack planning: side-channel + dictionary. Confirm the hostapd / wpa_supplicant version is patched against Dragonblood (post-April 2019).

## Tooling

- `hostapd-wpe` supports EAP-PWD.
- `freeradius` ships an EAP-PWD module.
- The Dragonblood paper authors released a research artifact at <https://wpa3.mathyvanhoef.com/> with side-channel exploitation code.

## See also

- [SAE / Dragonfly](/wiki/concepts/sae-dragonfly/) — the same primitive in WPA3-Personal.
- [Dragonblood](/wiki/attacks/dragonblood/) — the attack family.
- [EAP framework](/wiki/concepts/eap-framework/).

## References

- RFC 5931 — *EAP Authentication Using Only a Password*.
- Vanhoef + Ronen — *Dragonblood: A Security Analysis of WPA3's SAE Handshake* — IEEE S&P 2020.
- RFC 9380 — *Hashing to Elliptic Curves*.
