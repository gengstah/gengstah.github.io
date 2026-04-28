---
title: Wi-Fi Handshakes
permalink: /wiki/concepts/handshakes/
layout: single
author_profile: true
tags:
- airsnitch
- wifi
- concept
sources:
- ndss2026-paper
updated: 2026-04-28
redirect_from:
- /wiki/concepts/handshakes/
---

Five handshakes carry [Wi-Fi keys](/wiki/concepts/wifi-key-hierarchy/) between the AP and a client. AirSnitch exploits weaknesses in *what each one is allowed to deliver*.

## 4-way handshake

The flagship. Run after 802.11 authentication and association on every fresh connection. Derives the PTK from the PMK + nonces + MAC addresses, and delivers the AP's GTK and IGTK to the client encrypted under the just-derived PTK. Opens the 802.11i "controlled port" (IEEE 802.11i §5.9.2.1) on success.

Relevance to AirSnitch:

- The PMK→PTK derivation is what allows [machine-on-the-side](/wiki/attacks/machine-on-the-side/): with WPA2-PSK, any insider who knows the passphrase plus the captured EAPOL frames can compute the victim's PTK.
- The handshake is also the entry point for [port stealing](/wiki/attacks/port-stealing/): if the attacker authenticates with the *victim's* MAC on a different BSSID, completing this handshake overwrites the AP's per-BSSID `<MAC, PTK>` mapping for that MAC.
- The GTK delivered here *can* be randomized per client (Passpoint DGAF Disable). The other handshakes below cannot (NDSS'26 §IV-B-2).

## Group-key handshake

Two-message EAPOL exchange that delivers a refreshed GTK to existing clients. APs use it to rotate the GTK on a timer (typical: 1 hour).

Relevance:

- Some vendors do not rotate the GTK at all, or only on a long timer. A revoked client retains the GTK until rotation. (NDSS'26 §IV-B-1.)
- **The Passpoint spec does not require GTK randomization in this handshake.** So even if the initial GTK was random per-client, the rotated GTK delivered here may be the *real* shared GTK — handing the attacker the key they need for [abusing GTK](/wiki/attacks/abusing-gtk/).

## Fast BSS Transition (FT) handshake (IEEE 802.11r)

Used when a client roams between APs in the same Mobility Domain (typical of enterprise / `eduroam` setups). FT skips a full re-association by re-using cached key material and exchanging only "FT Action" frames.

Relevance: **Passpoint does not mandate randomized GTK in FT.** The attacker can spoof a BSS Transition Request to make the victim roam, triggering FT, which delivers the real shared GTK to the victim (and to anyone monitoring with stolen credentials) (NDSS'26 §IV-B-2).

## Fast Initial Link Setup (FILS) handshake (IEEE 802.11ai)

Optimised initial association used when low join latency matters. Bundles association, EAP-style auth, and IP address acquisition into fewer frames.

Relevance: **Passpoint does not mandate randomized GTK in FILS.** Same flaw as FT.

## WNM-Sleep Request / Response (IEEE 802.11v)

Wireless Network Management sleep transitions. A client tells the AP it is going to sleep; the AP responds. The response *can carry a GTK*, because group keys may have rotated while the client slept.

Relevance:

- **Passpoint does not mandate randomized GTK in WNM-Sleep Response.** Same flaw.
- Worse, the standard does not prohibit a *broadcast* receiver address on a WNM-Sleep Response. AirSnitch crafts a broadcast WNM-Sleep Response authenticated under the shared [IGTK](/wiki/concepts/wifi-key-hierarchy/) carrying an *attacker-chosen* GTK. Most clients will install it (NDSS'26 §IV-B-2). See [Passpoint flaws](/wiki/attacks/passpoint-flaws/).

## Open management frames not protected by IGTK

Deauthentication and disassociation are management frames. Without [Management Frame Protection (MFP)](/wiki/concepts/mfp/) they are unauthenticated and can be forged by any attacker on the channel. AirSnitch uses spoofed deauth to disconnect a victim and force a fresh 4-way handshake when [machine-on-the-side](/wiki/attacks/machine-on-the-side/) needs to capture EAPOL frames (NDSS'26 §IV-A).

## Relevance summary

| Handshake | Carries GTK? | Passpoint randomizes? | Used by which attack? |
| --- | --- | --- | --- |
| 4-way handshake | yes | yes | machine-on-the-side, port stealing |
| Group-key handshake | yes (rotation) | **no** | Passpoint flaws |
| FT handshake | yes | **no** | Passpoint flaws |
| FILS handshake | yes | **no** | Passpoint flaws |
| WNM-Sleep Response | yes | **no** | Passpoint flaws (incl. forged broadcast WNM via IGTK) |
| Deauth / Disassoc | n/a | n/a | trigger for re-handshake |

## See also

- [Wi-Fi key hierarchy](/wiki/concepts/wifi-key-hierarchy/)
- [Passpoint](/wiki/concepts/passpoint/)
- [Passpoint flaws](/wiki/attacks/passpoint-flaws/)
- [Group key randomization](/wiki/defenses/group-key-randomization/)
