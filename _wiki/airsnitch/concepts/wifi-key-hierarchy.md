---
title: Wi-Fi Key Hierarchy
permalink: /wiki/airsnitch/concepts/wifi-key-hierarchy/
layout: single
author_profile: true
tags:
- airsnitch
- wifi
- concept
sources:
- ndss2026-paper
updated: 2026-04-28
---

# Wi-Fi Key Hierarchy

The keys WPA2/WPA3 use, in the order they are derived, plus the role each one plays in [client isolation](/wiki/airsnitch/concepts/client-isolation/) bypasses.

## The hierarchy

```
                 ┌──────────────────┐
                 │   passphrase /   │
                 │  EAP credentials │
                 └────────┬─────────┘
                          │  (PBKDF2 for WPA2-PSK; Dragonfly/SAE for WPA3;
                          │   EAP master-session-key for Enterprise)
                          ▼
                  ┌──────────────┐
                  │     PMK      │   256-bit Pairwise Master Key
                  └──────┬───────┘
                         │  (4-way handshake: PMK, MACs, ANonce, SNonce)
                         ▼
                  ┌──────────────┐
                  │     PTK      │   Pairwise Transient Key — protects unicast
                  └──────────────┘

   ┌───────────┐     (random per-AP)
   │    GMK    │ ──────────────► ┌──────────────┐
   └───────────┘                 │     GTK      │  protects broadcast / multicast data
                                 └──────────────┘
                                 ┌──────────────┐
                                 │     IGTK     │  authenticates broadcast mgmt frames
                                 └──────────────┘
                                 ┌──────────────┐
                                 │ BIGTK / WIGTK│  beacons / wake-up frames (modern WPA3)
                                 └──────────────┘
```

(NDSS'26 §II-B)

## The keys, one by one

### PMK — Pairwise Master Key

256 bits. Derived from the credentials a station authenticates with. Fundamental difference between WPA modes:

- **WPA2-PSK**: PMK = PBKDF2(passphrase, SSID). *Identical for every client.* Implication: any insider with the passphrase can derive any other client's PTK by sniffing their 4-way handshake. See [machine-on-the-side](/wiki/airsnitch/attacks/machine-on-the-side/).
- **WPA3-SAE**: PMK is derived via the [Dragonfly handshake](https://datatracker.ietf.org/doc/html/rfc7664). Even with the shared passphrase, the resulting PMK is unique per session and cannot be derived from passive observation. Defeats machine-on-the-side but enables [rogue AP](/wiki/airsnitch/attacks/rogue-ap/) instead.
- **WPA2/WPA3-Enterprise (EAP)**: PMK is derived from the EAP MSK; per-user, established with a RADIUS server.

### PTK — Pairwise Transient Key

Derived during the [4-way handshake](/wiki/airsnitch/concepts/handshakes/) from PMK + AP MAC + STA MAC + ANonce + SNonce. Encrypts and authenticates **unicast** Wi-Fi frames between the AP and one specific client.

The decoupling that AirSnitch [port stealing](/wiki/airsnitch/attacks/port-stealing/) exploits: `hostapd` stores PTK in a per-BSSID `<MAC, PTK>` map. If an attacker on a different BSSID completes a 4-way handshake using the *victim's* MAC, the AP overwrites the PTK binding for that MAC. Frames intended for the victim are then encrypted with the *attacker's* PTK and forwarded to the attacker's BSSID (NDSS'26 §V-B).

### GMK — Group Master Key

Random per-BSSID. Lives only on the AP. Used to derive the GTK and (re-)derive new GTKs during periodic refresh. Never sent over the air.

### GTK — Group Temporal Key

Encrypts and authenticates **broadcast and multicast data** frames. **Shared by every client on a BSSID** by default. Sent to each client over the wire of the encrypted EAPOL handshake.

This sharing is the root of [GTK abuse](/wiki/airsnitch/attacks/abusing-gtk/): an insider who has done one 4-way handshake on the BSSID has the same GTK the AP uses to broadcast, so they can construct broadcast frames that look like they came from the AP.

GTK is rotated periodically (typical default: 1 hour) via the [group-key handshake](/wiki/airsnitch/concepts/handshakes/#group-key-handshake). Most APs *do not* rotate it when a client leaves. So a former guest who has lost network access can still inject for up to one rotation period (NDSS'26 §IV-B-1).

### IGTK — Integrity Group Temporal Key

Authenticates (does **not** encrypt) broadcast and multicast *management* frames. Required when [Management Frame Protection (MFP)](/wiki/airsnitch/concepts/mfp/) is enabled.

Even when GTK is randomized per client (Passpoint DGAF Disable), IGTK *is not required* to be randomized. An attacker can use the shared IGTK to authenticate a forged broadcast WNM-Sleep Response carrying an attacker-chosen GTK; the victim installs that GTK and the attacker can now broadcast under it (NDSS'26 §IV-B-2). See [Passpoint flaws](/wiki/airsnitch/attacks/passpoint-flaws/).

### BIGTK and WIGTK

BIGTK protects beacon integrity in WPA3 (Beacon Protection). WIGTK protects 802.11ba wake-up radio frames. The AirSnitch authors tried abusing both for client-isolation bypass and could not (NDSS'26 §IV-B-2 closing paragraph). Worth re-checking as the standard evolves.

## Quick reference: who knows what

| Key | Per-BSSID? | Per-client? | Sent over the air? |
| --- | --- | --- | --- |
| PMK | shared (PSK) / unique (EAP) | shared (PSK) / unique (EAP) | no |
| PTK | — | unique | derived from nonces, never sent |
| GMK | yes | no (AP only) | no |
| GTK | yes | shared (default) / unique (DGAF) | yes, encrypted with PTK |
| IGTK | yes | shared (default) | yes, encrypted with PTK |
| BIGTK | yes | shared | yes |

## See also

- [Handshakes](/wiki/airsnitch/concepts/handshakes/) — where each key is delivered.
- [Passpoint](/wiki/airsnitch/concepts/passpoint/) — the only spec that recommends randomized GTK.
- [Abusing GTK](/wiki/airsnitch/attacks/abusing-gtk/), [Passpoint flaws](/wiki/airsnitch/attacks/passpoint-flaws/), [Port stealing](/wiki/airsnitch/attacks/port-stealing/) — what each key enables.
- [Group key randomization](/wiki/airsnitch/defenses/group-key-randomization/) — the fix.
