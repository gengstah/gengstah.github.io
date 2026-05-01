---
title: "WPS (Wi-Fi Protected Setup)"
permalink: /wiki/concepts/wps/
layout: single
author_profile: true
tags:
  - wifi
  - concept
  - wps
  - consumer
---

*The "easy onboarding" feature on consumer Wi-Fi routers. Originally meant to replace typing a passphrase; in practice the largest single source of consumer Wi-Fi compromise from 2011 onward.*

**Status:** drafting
**Related:** [Pixie Dust](/wiki/attacks/pixie-dust-wps/), [WPA versions](/wiki/concepts/wpa-versions/), [Reaver vs Bully vs Pixiewps](/wiki/concepts/wps/)

---

## What WPS does

The user enters an 8-digit PIN (or pushes a button); after a short exchange the AP transfers the PSK to the requester. WPS sits on top of EAP and runs in two modes:

- **PIN-based** — STA proves knowledge of the AP's PIN (or vice-versa). PIN is printed on the router label.
- **Push Button Configuration (PBC)** — a 2-minute window after the user presses a button. Any STA that initiates a WPS exchange in that window is admitted.

Other modes (NFC, USB key) exist but are nearly nonexistent in practice.

## The PIN: 8 digits, only 11,000 attempts

The 8-digit PIN's **last digit is a check digit**, leaving 7 unknown digits = 10,000,000 candidates. But a critical protocol detail: the AP authenticates the **first half** of the PIN, then the **second half**, separately, in distinct EAP messages.

- First half: 4 digits = 10,000.
- Second half: 3 unknown digits + check = 1,000.

So the true brute-force space is **11,000**, not 10,000,000. The AP unwittingly tells you whether the *first half* was right by responding with EAP-NACK at a specific message vs. continuing.

**Reaver** (Stefan Viehböck, 2011) automated this online attack: ~11,000 EAP exchanges at ~1–2 per second = 3 to 12 hours to recover the PIN, and from the PIN, the PSK.

## Pixie Dust — offline brute force

Bongard's 2014 [Pixie Dust](/wiki/attacks/pixie-dust-wps/) attack collapsed the 3–12-hour online window into seconds. Many AP chipsets (Ralink, Realtek, certain Broadcom variants) used predictable PRNG seeds for the secret nonces E-S1 / E-S2 in the WPS exchange. With one captured WPS message exchange, an attacker brute-forces the PRNG state offline, recovers E-S1 / E-S2, and from them the PIN.

Vulnerable chipsets remain in the field on a depressing fraction of consumer hardware.

## WPS-locking and rate-limiting

Modern firmware implements WPS lockout: after N failed attempts (commonly 10), the AP rate-limits or disables WPS for a cooldown period (5–60 minutes, sometimes permanently until reboot). This slows Reaver but **does not stop Pixie Dust** — Pixie Dust needs only one exchange.

Some firmware re-enables WPS automatically after the cooldown, allowing patient attackers to keep cycling.

## What still ships with WPS in 2026

- A meaningful fraction of consumer routers ship WPS **enabled by default** at first boot.
- "Disable WPS" in the web UI sometimes only disables the PIN method, leaving PBC active. Some firmware doesn't honour the toggle for the WAN-side admin device.
- ISP-supplied gateways (Comcast, BT, Telstra, Movistar) frequently ship with WPS PIN engraved on a label and enabled.

## Relationship to WPA3

WPS was specified for WPA2. Wi-Fi Alliance has not extended it to WPA3. **DPP (Device Provisioning Protocol / Wi-Fi Easy Connect)** is the WPA3-era replacement — see [DPP / Easy Connect](/wiki/concepts/dpp-easy-connect/). WPA3-Personal networks that retain WPS-PIN on a 2.4 GHz transition-mode SSID inherit WPS's weaknesses.

## Operator workflow

| Step | Tool | Notes |
|---|---|---|
| Detect WPS | `wash` | Lists WPS-enabled BSSIDs, version, locked status. |
| Try Pixie Dust | `pixiewps` (called by Reaver `-K 1`) | Vulnerable chipset → seconds. |
| Online PIN | `reaver -i wlan0mon -b <BSSID> -vv` | Default 1 PIN/sec; tune with `-d`, `-l`. |
| Bully (alt) | `bully` | Different EAP state machine; sometimes works where Reaver doesn't. |
| Crack PSK | `airodump-ng` + `hashcat -m 22000` | Once PSK leaks via WPS PIN, normal cracking. |

`oneshot` (Python) is a maintained Reaver/Pixiewps wrapper popular in 2025–26.

## Defensive

The only complete fix is to **disable WPS in firmware**. Verify with `wash` after disabling — some firmware lies. Where WPS cannot be disabled, prefer hardware that has been firmware-updated past the Pixie Dust fix.

## See also

- [Pixie Dust](/wiki/attacks/pixie-dust-wps/) — the offline-PRNG attack.
- [DPP / Easy Connect](/wiki/concepts/dpp-easy-connect/) — WPS's successor for WPA3.
- [WPA versions](/wiki/concepts/wpa-versions/) — modes WPS attaches to.

## References

- Viehböck — *Brute forcing Wi-Fi Protected Setup* — 2011 — <https://sviehb.files.wordpress.com/2011/12/viehboeck_wps.pdf>
- Bongard — *Offline brute-force attack on WiFi Protected Setup* — Hack.lu 2014 — <http://archive.hack.lu/2014/Hacklu2014_offline_bruteforce_attack_on_wps.pdf>
- pixiewps project — <https://github.com/wiire-a/pixiewps>
