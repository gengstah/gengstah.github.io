---
title: "WNM, ANQP, and Hotspot 2.0"
permalink: /wiki/concepts/wnm-anqp/
layout: single
author_profile: true
tags:
  - wifi
  - concept
  - 80211u
  - anqp
  - hotspot-2
  - passpoint
---

*Pre-association queries: how a STA learns a network's identity, capabilities, and roaming relationships before it associates. WNM (802.11v) and ANQP (802.11u) underpin Hotspot 2.0 / Passpoint and a chunk of the AirSnitch attack chain.*

**Status:** drafting
**Related:** [Passpoint](/wiki/concepts/passpoint/), [Action frames](/wiki/concepts/action-frames/), [Authentication and association](/wiki/concepts/authentication-association/), [AirSnitch overview](/wiki/concepts/airsnitch-overview/)

---

## The problem they solve

Pre-WNM/ANQP, a STA had to associate with a BSS to learn anything about it beyond the SSID and RSN IE. Did this network bridge to the internet? Was it a captive portal? What roaming partners did it have? Could you authenticate with your home credential?

ANQP (Access Network Query Protocol) lets a STA ask those questions **before** association.

## GAS — the transport

ANQP is carried in **Generic Advertisement Service** (GAS) frames, which are Public Action frames (Action category 4 — `Public`). Two subtypes:

- **GAS Initial Request** — STA → AP. Contains an Advertisement Protocol element (e.g. ANQP) and a query.
- **GAS Initial Response** — AP → STA. Contains the answer.

For long answers, **GAS Comeback Request / Response** chunked variants exist.

GAS is **pre-association**. The STA doesn't have to authenticate or associate to send a GAS query; the BSS doesn't have to be one the STA's profile knows about. This is the key feature — and the key surface.

## ANQP elements

The ANQP elements a STA can request:

| ID | Element | What it carries |
|---|---|---|
| 257 | Capability list | Which other elements this AP knows. |
| 258 | Venue Name | "Starbucks", "JFK Terminal 4". |
| 259 | Emergency Call Number | E911. |
| 260 | Network Authentication Type | None / Online enrolment / Captive portal / DNS redirect / HTTP-redirect. |
| 261 | Roaming Consortium | OI list (WBA, Boingo, etc.). |
| 262 | IP Address Type Availability | IPv4/IPv6 yes/no. |
| 263 | NAI Realm List | EAP realms accepted (`example.com`, `roaming.eduroam.org`). |
| 264 | 3GPP Cellular Network | PLMNs supported (carrier offload). |
| 265 | AP Geospatial Location | LCI (where the AP claims to be). |
| 266 | AP Civic Location | Street address. |
| 267 | AP Location Public ID URI | URL to look up location. |
| 268 | Domain Name | `example.com` — the AP's home domain. |
| 269 | Emergency Alert URI | |
| 270 | TDLS Capability | |
| 271 | Emergency NAI | |
| 272 | Neighbor Report | (legacy) |
| 280 | Venue URL | |
| 281 | Advice of Charge | |

Hotspot 2.0 adds a parallel set of HS 2.0 ANQP elements (HS 2.0 capability, OSU providers, NAI home realm query/response, etc.) under a different OUI.

## Hotspot 2.0 / Passpoint

The Wi-Fi Alliance certification on top of 802.11u. A Hotspot-2.0 SSID is one whose beacon advertises an Interworking IE and that supports HS 2.0 ANQP. Defines:

- **OSU (Online Sign-Up)** — a server URL the STA contacts to register and obtain credentials.
- **NAI Home Realm Query** — STA asks "do you support my home realm `myorg.example.com`?"; AP answers yes/no based on roaming agreements.
- **Subscription Remediation** — STA's credential can be remotely refreshed.

A device with a Passpoint profile (provisioned by the carrier) auto-joins any Hotspot 2.0 SSID that confirms the home realm match — no human interaction. Carrier Wi-Fi offload (T-Mobile, AT&T, Boingo, Eduroam) runs on this.

See [Passpoint](/wiki/concepts/passpoint/) for the full picture.

## Offensive surface

### Pre-association recon

A simple GAS query (no association required) extracts venue name, NAI realms, roaming partners, geospatial location. A drive-by attacker can fingerprint every Hotspot-2.0 AP without authenticating to any of them.

### NAI Realm spoofing

An attacker AP advertising the victim's home realm in its NAI Realm List can convince the victim's Passpoint-provisioned device to attempt EAP — at which point the standard rogue-RADIUS / cert-validation games apply.

### Passpoint flaws (AirSnitch)

The [AirSnitch](/wiki/concepts/airsnitch-overview/) corpus exploits Hotspot-2.0-specific behaviour. Specifically, the **DGAF Disable** option (used by Passpoint to randomise GTK per client for confidentiality of broadcast frames) leaves IGTK *not* per-client. An attacker uses the shared IGTK to forge a WNM-Sleep Response carrying an attacker-chosen GTK, installing it on the victim. See [Passpoint flaws](/wiki/attacks/passpoint-flaws/) and [Abusing GTK](/wiki/attacks/abusing-gtk/).

### Captive portal redirect

Hotspot-2.0 networks can advertise `Network Authentication Type = Captive Portal` and a URL in the Network Authentication Type element. STAs auto-open the URL in the captive portal browser. An attacker AP can redirect to a credential-phishing / browser-exploit page.

## Detection / observation

- Beacons of Hotspot-2.0 networks include the **Interworking IE** (tag 107) and the **HS 2.0 Indication IE** (vendor-specific OUI 50:6F:9A).
- `tshark -Y wlan.fc.subtype == 0x0d && wlan_mgt.fixed.category_code == 4` filters Public Action; further filter on Advertisement Protocol element.
- `wpa_cli anqp_get` triggers an ANQP query from a Linux STA.

## Tooling

- `hostapd.conf`'s `interworking=1`, `hs20=1`, `venue_name=`, `nai_realm=`, `roaming_consortium=`.
- `wpa_supplicant` with `interworking=1` enables Passpoint matching.

## See also

- [Passpoint](/wiki/concepts/passpoint/) — the certification on top of 802.11u.
- [Action frames](/wiki/concepts/action-frames/) — GAS lives here (Public, category 4).
- [Authentication and association](/wiki/concepts/authentication-association/) — what comes after pre-association queries.
- [AirSnitch overview](/wiki/concepts/airsnitch-overview/) — Passpoint flaws.

## References

- IEEE 802.11u-2011 (folded into 802.11-2020 §11.22).
- Wi-Fi Alliance — *Hotspot 2.0 Specification v3.0*.
- *Hotspot 2.0 Online Sign-Up* — operator-side material.
