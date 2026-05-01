---
title: "Fast BSS Transition (802.11r)"
permalink: /wiki/concepts/fast-bss-transition/
layout: single
author_profile: true
tags:
  - wifi
  - concept
  - 80211r
  - roaming
  - ft
---

*Sub-50-millisecond roaming between BSSes in the same ESS, without re-running EAP or re-doing SAE. Critical for VoIP and large enterprise deployments — and a key-derivation surface that has been actively researched.*

**Status:** drafting
**Related:** [Authentication and association](/wiki/concepts/authentication-association/), [Wi-Fi key hierarchy](/wiki/concepts/wifi-key-hierarchy/), [Radio Resource Management](/wiki/concepts/radio-resource-mgmt/), [WNM and ANQP](/wiki/concepts/wnm-anqp/)

---

## What FT is for

Without 802.11r, roaming a STA from BSSb to BSSb' in the same ESS means:

1. Authenticate to BSSb'.
2. Associate to BSSb'.
3. Run the full EAP exchange (or full SAE) to derive a fresh PMK.
4. Run the 4-way handshake.

For Enterprise EAP this can take 700–1500 ms — long enough to drop a VoIP call. FT collapses it to <50 ms by reusing key material derived during the **initial mobility-domain association**.

## The key hierarchy under FT

FT introduces a two-level key derivation:

```
              MSK (from EAP) or password (PSK / SAE)
                       │
                       ▼
                  PMK-R0  ← per-mobility-domain key
                  derived once per supplicant per MD
                       │
                       ▼
                  PMK-R1  ← per-AP per-supplicant
                  one R1 per AP in the MD
                       │
                       ▼
                  PTK     ← per-association
```

PMK-R0 lives at the **R0 Key Holder (R0KH)** — usually the WLAN controller. PMK-R1 is delivered to each **R1 Key Holder (R1KH)** — each AP — when the supplicant arrives or as the controller chooses.

The Mobility Domain (MD) is identified by a 2-byte **Mobility Domain ID (MDID)** advertised in beacons.

## Two flavours of FT

### FT over the air (OTA)

The STA does a 4-message FT Authentication exchange directly with the new AP, using FT Authentication algorithm (algo=2):

```
STA                            new AP
 │── FT Req (PMK-R0Name, SNonce) ──►
 │  ◄── FT Resp (ANonce, R1KH-ID) ──
 │── Reassociation Req (MIC) ──►
 │  ◄── Reassociation Resp ──
 │ PTK installed
```

### FT over the DS (Distribution System)

The STA tunnels the FT Action exchange to the new AP via the *current* AP, over the wired backbone. This is faster because the STA never goes off-channel — useful for sub-50 ms roaming on busy networks.

## Why offence cares

### Cross-AP traffic visibility

PMK-R0 lives on the controller. If an attacker has any AP-equivalent privilege on the controller (vulnerable management interface, vendor backdoor, malicious admin), they can exfiltrate every supplicant's PMK-R0 — and thus derive every PTK on every AP in the MD.

### MIC binding bugs

The FT Reassociation Request carries an FTE (Fast BSS Transition Element) and an MIC over a transcript. Several historical bugs:

- **CVE-2017-13082 (KRACK against FT)** — the FT response was replayable, reinstalling the PTK with a reset replay counter.
- **MICs computed over an under-specified transcript** — multiple implementations had pre-2018 bugs accepting forged MICs.

Modern stacks fixed these; older AP firmware is sometimes still in field.

### MDIE rewriting

The Mobility Domain IE in beacons advertises which controllers / R0KH a STA can roam to. An attacker manipulating an MDIE can trick a STA into attempting an FT roam to a forged BSS pretending to be in the same MD; the STA sends FT credentials to the attacker. This requires either being on-path or convincing the STA to scan a channel where the attacker is.

### 802.11r + WPA3-SAE-FT

FT-SAE (AKM 9) combines FT with SAE. The R0 derivation uses the SAE-derived PMK as input. Same FT exchange semantics; same caveats. Recently deployed on Wi-Fi 6 enterprise gear.

## Detection

- An RSN IE with AKM `00:0F:AC:3` (FT-802.1X) or `00:0F:AC:4` (FT-PSK) or `00:0F:AC:9` (FT-SAE) means FT is offered.
- `tshark -Y wlan.fc.subtype == 0x0b && wlan_mgt.fixed.auth.alg == 0x0002` to see FT Authentication frames.
- `wpa_cli` will show `key_mgmt=FT-PSK` or similar when FT is in use.

## Tooling

- `hostapd.conf` — `mobility_domain=`, `r0_key_holders=`, `r1_key_holders=`, `nas_identifier=`.
- `wpa_supplicant.conf` — `key_mgmt=FT-PSK FT-SAE FT-EAP`.

## See also

- [Authentication and association](/wiki/concepts/authentication-association/) — FT Authentication algorithm 2.
- [Wi-Fi key hierarchy](/wiki/concepts/wifi-key-hierarchy/) — extended with R0/R1 under FT.
- [Radio Resource Management](/wiki/concepts/radio-resource-mgmt/) and [WNM](/wiki/concepts/wnm-anqp/) — how STAs decide *when* to roam.

## References

- IEEE 802.11r-2008 (folded into 802.11-2020 §13).
- Vanhoef + Piessens — *KRACK* — CCS 2017 — FT-specific variants.
