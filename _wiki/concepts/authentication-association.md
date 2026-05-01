---
title: "Authentication and Association"
permalink: /wiki/concepts/authentication-association/
layout: single
author_profile: true
tags:
  - wifi
  - concept
  - mac
  - handshakes
---

*The two pre-data-flow exchanges every Wi-Fi client goes through before it can send L3 traffic — and the entry points for the next class of handshakes (4-way, FT, SAE).*

**Status:** drafting
**Related:** [Handshakes](/wiki/concepts/handshakes/), [SAE / Dragonfly](/wiki/concepts/sae-dragonfly/), [Fast BSS Transition](/wiki/concepts/fast-bss-transition/), [WPA versions](/wiki/concepts/wpa-versions/)

---

## The state machine

A client moves through three states with a given AP:

```
   Unauthenticated, Unassociated
              │
              │ Authentication (Open / SAE / FT)
              ▼
   Authenticated, Unassociated
              │
              │ Association Request / Response
              ▼
   Authenticated, Associated
              │
              │ 4-way handshake (when WPA enabled)
              ▼
   Data flow with PTK / GTK installed
```

Each transition is a separate frame exchange. The classic 802.11 mistake — fixed in modern designs — was treating Authentication as a real cryptographic anchor; today it is mostly a vestigial step except under SAE and FT.

---

## Authentication frame (subtype 11)

The Authentication frame is **before** any encryption is set up. Always sent in cleartext. Carries an `Authentication Algorithm Number`:

| Algorithm | Number | Use |
|---|---|---|
| Open System | 0 | The default; no real auth. Two-frame exchange. |
| Shared Key | 1 | WEP only. Deprecated. |
| Fast BSS Transition | 2 | 802.11r FT roams. |
| SAE | 3 | WPA3-Personal. Multi-frame Dragonfly. |
| FILS Shared Key / Public Key | 4 / 5 | 802.11ai (rare). |
| Network Initiate / Resp | … | Mesh, etc. |

### Open System

Two-frame exchange:

1. STA → AP: `Auth { algo=0, seq=1, status=0 }`
2. AP → STA: `Auth { algo=0, seq=2, status=0 }`

That's it. The AP accepts any well-formed frame. Open auth predates real Wi-Fi security; it survives because RSN authentication happens later, in the 4-way handshake.

### SAE (WPA3-Personal)

Multi-frame Dragonfly handshake. Both sides commit to an ephemeral element, exchange confirms, derive a per-session PMK. See [SAE / Dragonfly](/wiki/concepts/sae-dragonfly/).

### Fast BSS Transition

A roaming client can authenticate to a new BSS in the same Mobility Domain *before* leaving the current one (over-the-DS) or in two frames (over-the-air), reusing PMK-R0/R1 derived during initial association. See [Fast BSS Transition](/wiki/concepts/fast-bss-transition/).

---

## Association

Once authenticated, the client sends an Association Request:

- Capability info (ESS, Privacy, Short Preamble, MFP-required, etc.).
- Listen Interval (how often the STA wakes during power-save).
- SSID IE.
- Supported Rates / Extended Supported Rates.
- HT / VHT / HE / EHT capabilities.
- RSN IE — what cipher suites and AKM the STA wants to use. **Must match the AP's RSN IE** for the 4-way handshake to succeed.
- Various extensions (mobility domain, RM enabled capabilities, vendor IEs).

The AP replies with Association Response, including an **Association ID (AID)** — a 14-bit number that identifies the client in the AP's TIM bitmap thereafter.

After Association Response, the STA is a member of the BSS. With WPA disabled (open network) it can immediately send data. With WPA enabled, the [4-way handshake](/wiki/concepts/handshakes/) starts.

## Reassociation

Reassociation is functionally similar to Association but signals "I was previously associated to a BSS in the same ESS, and I'm telling you what I was doing". It carries the previous BSSID. APs use this to coordinate buffered-traffic transfer across BSSes in the same ESS.

## RSN downgrade and cipher mismatch

The RSN IE in Probe Response, Beacon, Association Request, and the 4-way handshake messages must all be **byte-identical** (well, equal under a structural comparison the spec defines). [KRACK](/wiki/attacks/krack/) is the canonical attack that pivoted on this — replay of the third 4-way message reset the nonce after the cipher had already been negotiated.

A weaker historic class: the AP's beacon advertises (e.g.) `CCMP only`, the STA's Association Request asks for `TKIP-or-CCMP`, the AP overrides with `CCMP`. Until 802.11i, an MITM could rewrite the AP-side RSN IE to force TKIP. Modern stacks reject this.

## Protected Management Frames boundary

Auth, Association, Reassociation, and Action frames are not yet covered by PTK at the time they are sent (the PTK isn't installed until after the 4-way handshake completes). [MFP](/wiki/concepts/mfp/) covers Disassociation and Deauthentication and a subset of Action frames *after* PTK install, but does not retroactively protect anything pre-association. Forged Auth/Assoc frames are still possible.

This is precisely why [SAE](/wiki/concepts/sae-dragonfly/) — which authenticates the STA *before* any unprotected exchange — is a step up: SAE authenticates inside the Authentication frame itself.

## Tooling

- `wireshark` filter `wlan.fc.type_subtype == 0x0b` for Auth, `0x00` for Association Request, `0x01` for Association Response.
- `aircrack-ng`'s `aireplay-ng -1 0 -a <BSSID>` performs a fake Auth+Assoc to keep a session alive (PTK isn't completed; mostly useful for tests of AP behaviour).
- `hostapd_cli`'s `sta` table prints the live state of every associated STA.

## See also

- [Handshakes](/wiki/concepts/handshakes/) — 4-way, group-key, FT.
- [SAE / Dragonfly](/wiki/concepts/sae-dragonfly/) — the WPA3-Personal auth.
- [WPA versions](/wiki/concepts/wpa-versions/) — modes' impact on the auth path.
- [MFP](/wiki/concepts/mfp/) — what's protected and what isn't.

## References

- IEEE 802.11-2020 §11.3 (MLME Authentication / Association).
- Vanhoef + Piessens — *KRACK: Key Reinstallation Attacks* — CCS 2017 — RSN-IE replay aspects.
