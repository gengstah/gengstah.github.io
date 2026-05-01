---
title: "DPP — Device Provisioning Protocol (Wi-Fi Easy Connect)"
permalink: /wiki/concepts/dpp-easy-connect/
layout: single
author_profile: true
tags:
  - wifi
  - concept
  - dpp
  - easy-connect
  - provisioning
---

*The Wi-Fi Alliance replacement for [WPS](/wiki/concepts/wps/) — out-of-band public-key bootstrapping (QR code, NFC, Bluetooth, PKEX) that lets a device join a Wi-Fi network without typing the passphrase. Designed-from-scratch for WPA3 era, with PKI-equivalent assurance.*

**Status:** drafting
**Related:** [WPS](/wiki/concepts/wps/), [SAE / Dragonfly](/wiki/concepts/sae-dragonfly/), [WPA versions](/wiki/concepts/wpa-versions/), [Action frames](/wiki/concepts/action-frames/)

---

## What it is

Wi-Fi CERTIFIED Easy Connect (DPP). Two roles:

- **Configurator** — already on the network. Holds the Wi-Fi credential. Owns the right to grant access.
- **Enrollee** — wants to join. Has only an out-of-band channel to the Configurator.

Each device has a permanent **bootstrapping key pair** (P-256 default). The bootstrapping public key is exchanged out-of-band — typically by the Configurator scanning a QR code printed on / displayed by the Enrollee.

After the OOB exchange, DPP runs over Wi-Fi Action frames:

```
Enrollee                       Configurator
 │── DPP Authentication Req ──►
 │  ◄── DPP Authentication Resp ──
 │── DPP Authentication Confirm ──►
 │
 │── DPP Configuration Req ──►
 │  ◄── DPP Configuration Resp ──     (network credential, signed)
 │
 │  STA configures Wi-Fi profile from received credential
 │  Joins the SSID via SAE / OWE / Enterprise as configured.
```

## Bootstrapping methods

| Method | Notes |
|---|---|
| QR code | Most common. Enrollee displays QR; Configurator (phone app) scans. |
| NFC | Tap-to-pair. |
| Bluetooth | Bluetooth-LE-based bootstrap. |
| PKEX (Password-Authenticated Key Exchange) | Both peers know a short secret; derive a curve point. Used when no QR/NFC channel exists. |

## Why it's better than WPS

- **No 8-digit PIN.** No 11,000-attempt brute force. No [Pixie Dust](/wiki/attacks/pixie-dust-wps/).
- **Public-key authentication.** The Configurator authenticates the Enrollee by its bootstrapping public key (read from the QR). Only the Enrollee with the matching private key can complete the protocol.
- **Configurator-issued network access.** The Configurator can issue credentials for SAE, EAP-TLS, EAP-PWD, OWE — any WPA3 mode.
- **Per-device credentials.** Each Enrollee can get a different per-device passphrase / cert. Revoke one without disturbing others.

## Protocol details

### Authentication

DPP Authentication is a 3-message exchange that derives a shared key `ke` from:

- Enrollee's bootstrapping public key (known by Configurator from QR).
- Per-session ephemeral keys.
- Implicit responder identity.

Messages 2 and 3 carry MICs proving knowledge of the bootstrapping private key.

### Configuration

After Authentication, the Enrollee requests a configuration; the Configurator returns a signed JSON Web Signature (JWS) "Connector" containing the credential plus the Configurator's signing key. This Connector lets the Enrollee later authenticate to other Configurator-trusted devices in **DPP Network Introduction** (peer-to-peer or AP-issued).

### Network Introduction

For DPP-only networks, two Connector-bearing devices can authenticate to each other without a passphrase: each presents its Connector, both verify the Configurator's signature, and they derive a session key directly. No SAE needed.

## Attack surface

- **Bootstrapping channel weakness.** If the QR code is photographed and re-scanned by an attacker (e.g. paper QR left on a bench), the attacker now knows the Enrollee's bootstrapping public key. *That's not a compromise* — it's just a public key. But combined with PKEX where a short secret is the only thing standing between the attacker and the credential, it can matter.
- **PKEX dictionary attacks.** PKEX uses a low-entropy code; a passive observer can offline-crack it if both peers' messages are captured.
- **Configurator compromise.** A Configurator with attacker-controlled software can issue credentials to attacker devices. Apps acting as Configurators are a worthwhile target.
- **Implementation flaws.** hostapd / wpa_supplicant DPP code received fixes in 2020–2024 for state-machine and parsing bugs. Older versions have known issues.

## Adoption

Slow but increasing. As of 2026:

- Most Wi-Fi 6E / Wi-Fi 7 APs claim DPP support.
- Smart-home ecosystems (Matter / Thread bridges, Hue, smart bulbs) increasingly use DPP for Wi-Fi onboarding.
- Apple, Google, Samsung phones can act as Configurators with vendor apps.
- Vendor lock-in remains: cross-ecosystem DPP between (e.g.) an Apple phone and a Samsung-branded TV often falls back to vendor-specific flows.

## Tooling

- `hostapd_cli dpp_qr_code <URI>` — present bootstrap URI to the AP-side stack.
- `wpa_cli dpp_bootstrap_gen type=qrcode mac=<self_mac>` — Enrollee side.
- `tshark -Y wlan_mgt.fixed.action_code` then drill into Public Action with OUI 50:6F:9A (Wi-Fi Alliance) and DPP subtypes.

## See also

- [WPS](/wiki/concepts/wps/) — what DPP replaces.
- [SAE / Dragonfly](/wiki/concepts/sae-dragonfly/), [WPA versions](/wiki/concepts/wpa-versions/) — credentials DPP issues.
- [Action frames](/wiki/concepts/action-frames/) — DPP rides Public Action frames (vendor-specific OUI).

## References

- Wi-Fi Alliance — *Wi-Fi Easy Connect Specification v3.0* — <https://www.wi-fi.org/discover-wi-fi/wi-fi-easy-connect>.
- Harkins — *Device Provisioning Protocol* — author commentary.
