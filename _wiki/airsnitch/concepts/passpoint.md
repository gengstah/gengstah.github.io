---
title: Passpoint
permalink: /wiki/airsnitch/concepts/passpoint/
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

# Passpoint

**Passpoint** (Wi-Fi Alliance Hotspot 2.0) is a specification that turns "find the right SSID and accept the captive portal" into automatic, certificate-backed authentication. It exists primarily to make commercial public hotspots usable. From the AirSnitch perspective, what matters is that **Passpoint is the only Wi-Fi spec that explicitly tries to enforce client isolation at the encryption layer** — and the way it does it has design flaws that AirSnitch exploits.

## The relevant feature: DGAF Disable

Passpoint specifies *Downstream Group-Addressed Forwarding (DGAF) Disable* (Passpoint Specification §5.2). Per DGAF Disable, the AP is supposed to:

> "Set to a unique random value the value of the GTK employed in the 4-Way Handshake."

The intent: every client gets a *different* [GTK](/wiki/airsnitch/concepts/wifi-key-hierarchy/), so an insider's GTK can't be used to inject broadcast frames at any other client. To still handle protocols that genuinely need broadcast (ARP, DHCP), the AP performs **Proxy ARP** and other broadcast-to-unicast translations.

This is the right idea. The problem is what it omits.

## The flaws AirSnitch finds

**The spec only mentions the 4-way handshake.** It says nothing about randomization in:

- the [group-key handshake](/wiki/airsnitch/concepts/handshakes/#group-key-handshake) (used for periodic GTK rotation)
- the [FT handshake](/wiki/airsnitch/concepts/handshakes/#fast-bss-transition-ft-handshake-ieee-80211r)
- the [FILS handshake](/wiki/airsnitch/concepts/handshakes/#fast-initial-link-setup-fils-handshake-ieee-80211ai)
- WNM-Sleep Response frames

So a Passpoint-compliant AP can hand each client a unique random GTK on day one, and then deliver the *real shared GTK* to every client during the next periodic rotation. (NDSS'26 §IV-B-2.)

The attacker doesn't even have to wait for the rotation. Spoofing a BSS Transition Request triggers an FT handshake, which delivers the real GTK immediately.

**IGTK is not required to be random.** Passpoint's DGAF Disable does not extend to the IGTK. The IGTK is shared by every client by default. This lets the attacker forge broadcast WNM-Sleep Response frames *authenticated under the shared IGTK*, carrying an attacker-chosen GTK that the victim then installs. After that, the attacker broadcasts under a key the attacker chose, bypassing client isolation — even though the AP was honest. (NDSS'26 §IV-B-2.)

**No isolation outside Wi-Fi.** Passpoint addresses only the Wi-Fi encryption layer. It says nothing about [routing](/wiki/airsnitch/attacks/gateway-bouncing/) or [internal switching](/wiki/airsnitch/attacks/port-stealing/). So an attacker just routes around it.

## What's been fixed

- **Wi-Fi Alliance Passpoint v3.4** (2026): IGTK randomization is now required. Confirmed in NDSS'26 §VIII-D ("The Wi-Fi Alliance has addressed the missing randomization of the IGTK in version v3.4 of Passpoint.").
- The other handshakes (group-key, FT, FILS, WNM-Sleep) were not fixed in v3.4 as far as the AirSnitch authors document; check the latest spec when ingesting v3.5+.

## Why this matters even if you don't run Passpoint

- Most enterprise APs reuse the same handshakes and key-management code paths whether Passpoint is on or off. The flaws above are typically *implementation* defaults, not Passpoint-only behaviour. If your AP doesn't randomize the GTK in the group-key handshake when Passpoint is enabled, it almost certainly doesn't randomize it when Passpoint is disabled either.
- Defences that originated in Passpoint (DGAF Disable, Proxy ARP) are good ideas to enable on any network where you care about [client isolation](/wiki/airsnitch/concepts/client-isolation/). They just need to extend to all GTK-bearing handshakes and to IGTK.

## See also

- [Wi-Fi key hierarchy](/wiki/airsnitch/concepts/wifi-key-hierarchy/)
- [Handshakes](/wiki/airsnitch/concepts/handshakes/)
- [Passpoint flaws attack](/wiki/airsnitch/attacks/passpoint-flaws/)
- [Group key randomization defence](/wiki/airsnitch/defenses/group-key-randomization/)
