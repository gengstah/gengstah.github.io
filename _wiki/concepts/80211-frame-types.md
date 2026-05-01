---
title: "802.11 Frame Types"
permalink: /wiki/concepts/80211-frame-types/
layout: single
author_profile: true
tags:
  - wifi
  - concept
  - mac
  - frames
---

*The three frame classes in 802.11 — management, control, data — and the sub-types that map to the actions an attacker forges, replays, or strips off the air.*

**Status:** drafting
**Related:** [Beacon frames](/wiki/concepts/beacon-frames/), [Probe Request and PNL](/wiki/concepts/probe-requests-pnl/), [Authentication and association](/wiki/concepts/authentication-association/), [MFP](/wiki/concepts/mfp/)

---

## Frame Control field

Every 802.11 frame starts with a Frame Control field. Two fields decide what kind of frame it is:

| Bit field | Values | Meaning |
|---|---|---|
| Type | 0 / 1 / 2 / 3 | Management / Control / Data / Extension |
| Subtype | 0–15 | Subtype within the type |

`tcpdump -y IEEE802_11_RADIO -e` and `wireshark` decode these directly. `aircrack-ng` references frames by `Beacon`, `Auth`, `Deauth`, etc. — the same subtypes.

---

## Type 0 — Management frames

Frames that govern joining, leaving, and managing a BSS. **Unencrypted by default** (only protected when 802.11w / [MFP](/wiki/concepts/mfp/) is enabled, and even then only a subset).

| Subtype | Name | Direction | Notes |
|---|---|---|---|
| 0 | Association Request | STA → AP | After auth, before encrypted data. |
| 1 | Association Response | AP → STA | Carries AID. |
| 2 | Reassociation Request | STA → AP | When roaming to a new BSS in the same ESS. |
| 3 | Reassociation Response | AP → STA | |
| 4 | [Probe Request](/wiki/concepts/probe-requests-pnl/) | STA → broadcast or AP | Active scan. |
| 5 | Probe Response | AP → STA | |
| 8 | [Beacon](/wiki/concepts/beacon-frames/) | AP → broadcast | ~10 / sec. |
| 9 | ATIM | IBSS only | |
| 10 | Disassociation | STA ↔ AP | Reason code attached. |
| 11 | [Authentication](/wiki/concepts/authentication-association/) | STA ↔ AP | Open, Shared Key (legacy), SAE, FT. |
| 12 | Deauthentication | STA ↔ AP | Reason code attached. The classic forced-disconnect attack. |
| 13 | [Action](/wiki/concepts/action-frames/) | any | Big container — block-ack, BSS Transition Mgmt, RM, FT, channel switch. |
| 14 | Action No-Ack | any | |

**Why management frames are an attack surface.**

- Pre-MFP, a single deauth packet from any source MAC drops a client. The famous "deauth flood" predates 2010.
- MFP (802.11w, mandatory in WPA3) covers Disassociation, Deauthentication, and Robust Action frames, but **not Beacon, Probe, Auth, or Association**. The latter are still spoofable, which is why [rogue AP](/wiki/attacks/rogue-ap/) and channel-switch CSA-spoof attacks remain effective in 2026.

---

## Type 1 — Control frames

Frames that mediate channel access and acknowledgement. Tiny, MAC-only, no payload.

| Subtype | Name | Notes |
|---|---|---|
| 4 | Beamforming Report Poll | Wi-Fi 5+ |
| 5 | VHT NDP Announcement | |
| 7 | Control Frame Extension | |
| 8 | Block Ack Request (BAR) | |
| 9 | Block Ack (BA) | |
| 10 | PS-Poll | |
| 11 | RTS | Request to Send |
| 12 | CTS | Clear to Send |
| 13 | Ack | |
| 14 | CF-End | |

**Why control frames matter offensively.**

- **PS-Poll** is the request a station in power-save sends to retrieve frames the AP has been buffering. [Forging PS-Poll](/wiki/concepts/power-save-tim-dtim/) is part of the Vanhoef *Framing Frames* attack.
- **RTS/CTS** can be abused for DoS: spoofed CTS with a long Network Allocation Vector silences a channel for milliseconds at a time. Used in legacy "queensland attack" research.
- **Block Ack** sequence numbers and aggregation windows have been used in [FragAttacks](/wiki/attacks/fragattacks/) variants.

---

## Type 2 — Data frames

Carry the actual L2 payload (LLC/SNAP → IP). Many subtypes; the ones to know:

| Subtype | Name | Notes |
|---|---|---|
| 0 | Data | Plain data frame. |
| 4 | Null function | Empty data — used for power-save signalling. |
| 8 | QoS Data | WMM-tagged data (TID 0–7). Universal on modern hardware. |
| 12 | QoS Null | QoS variant of null function (power-save signalling). |
| 0–11 | (CF-Poll variants) | |

Data frames carry the **MSDU** (or fragments of it). Aggregated data frames carry an **A-MSDU** (multiple MSDUs in one MPDU) or are themselves part of an **A-MPDU** (multiple MPDUs in one PHY transmission). See [A-MSDU and A-MPDU](/wiki/concepts/amsdu-ampdu/).

The key offensive observation: data frames *are* encrypted under the PTK / GTK (when enabled), but the **A-MSDU bit in the QoS Control field is in the MAC header — outside the encrypted payload**. That is the [FragAttacks](/wiki/attacks/fragattacks/) substrate.

---

## Type 3 — Extension frames

Reserved type used by 802.11ah, 802.11p, and DMG (60 GHz). Not relevant to mainstream Wi-Fi attacks.

---

## ToDS / FromDS

The Frame Control's `ToDS` / `FromDS` bits classify direction:

| ToDS | FromDS | Meaning | Address fields |
|---|---|---|---|
| 0 | 0 | IBSS / direct STA-to-STA | Addr1=DA, Addr2=SA, Addr3=BSSID |
| 0 | 1 | AP → STA | Addr1=DA, Addr2=BSSID, Addr3=SA |
| 1 | 0 | STA → AP | Addr1=BSSID, Addr2=SA, Addr3=DA |
| 1 | 1 | WDS (mesh / 4-address) | All four addresses present |

The 4-address (WDS) form is what [Framing Frames](/wiki/attacks/framing-frames/) abuses: a malicious client sets ToDS=FromDS=1 to inject a frame that the AP forwards verbatim.

---

## Tooling

- `radiotap` headers prepend captured frames with PHY metadata (RSSI, channel, MCS).
- `aireplay-ng -0` injects deauth (subtype 12).
- `mdk4` injects most subtypes for stress-testing.
- `scapy` `Dot11()` builds frames programmatically with full subtype control.

## See also

- [Beacon frames](/wiki/concepts/beacon-frames/), [Probe Request and PNL](/wiki/concepts/probe-requests-pnl/) — the two unencrypted broadcast subtypes that leak the most information.
- [Action frames](/wiki/concepts/action-frames/) — the management-frame escape hatch (FT, RM, WNM-Sleep, CSA).
- [MFP](/wiki/concepts/mfp/) — which management frames are protected and which aren't.
- [A-MSDU and A-MPDU](/wiki/concepts/amsdu-ampdu/) — the data-frame aggregation surface.

## References

- IEEE 802.11-2020 §9 (Frame formats).
- Wireshark Wiki — *IEEE 802.11* — <https://wiki.wireshark.org/IEEE_802.11>.
