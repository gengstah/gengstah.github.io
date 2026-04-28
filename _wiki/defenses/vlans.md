---
title: VLANs and Firewall Rules
permalink: /wiki/defenses/vlans/
layout: single
author_profile: true
tags:
- airsnitch
- wifi
- defense
sources:
- ndss2026-paper
- airsnitch-readme
updated: 2026-04-28
redirect_from:
- /wiki/airsnitch/defenses/vlans/
---

The most practical defence available today against the L3 and switching-layer attacks. The principle: **put each isolation domain in its own VLAN and put firewall rules between them.**

The headline win, from NDSS'26 §VII-D and §VIII-C: a properly configured TP-Link EAP613 with guest BSSIDs in separate VLANs **nullifies every technique in the AirSnitch table** (Table VI). VLANs are not a complete answer — they don't help against [shared-passphrase attacks](/wiki/attacks/machine-on-the-side/) or against attackers within the same VLAN — but they make the cross-domain attacks much harder.

## What VLANs buy you

- **[Gateway Bouncing](/wiki/attacks/gateway-bouncing/) stops at the VLAN boundary.** Guest VLAN's gateway routes guest traffic. It refuses to route a packet from the guest VLAN to the main VLAN unless a firewall rule explicitly allows it. The L2-vs-L3 isolation gap goes away because the L3 boundary is now real.
- **[Port stealing](/wiki/attacks/port-stealing/) loses its target.** The bridge serving the guest VLAN's BSSIDs has no entry for any main-VLAN MAC. The attacker can't steal what isn't there.
- **[Broadcast Reflection](/wiki/attacks/broadcast-reflection/) stops at the VLAN boundary.** The AP's broadcast fan-out runs per-VLAN. A broadcast frame originating in the guest VLAN never reaches the main-VLAN clients.
- **[GTK abuse](/wiki/attacks/abusing-gtk/) stays within the VLAN** if the network uses per-VLAN GTKs (`gtk-per-vlan` option on some gear). An insider in the guest VLAN can still attack other guests, but can't attack the main network.

## What VLANs don't buy you

- **Within-VLAN isolation.** Two clients in the same VLAN are still on the same broadcast domain. If you put all your guests in one VLAN, the attacks work between guests. The strongest setup is **one VLAN per user / per device**.
- **[Machine-on-the-side](/wiki/attacks/machine-on-the-side/) and [Rogue AP](/wiki/attacks/rogue-ap/)** are unaffected by VLANs — they don't use the AP's data path.
- **Misconfigured firewall rules.** "Allow guest VLAN to reach the main printer" rules tend to grow over time. Each rule is potential attack surface.

## Per-VLAN setups in practice

Three common topologies:

1. **Two VLANs: main + guest.** The default for any vendor that supports VLANs. Stops cross-VLAN attacks. Doesn't stop intra-guest attacks.
2. **Per-SSID VLAN.** Each SSID (main, eduroam, IoT, guest) gets its own VLAN. Common in enterprises.
3. **Per-user VLAN.** Each user — identified by EAP identity, PPSK, or MAC — gets a unique VLAN. SRP / [supernetworks.org](https://www.supernetworks.org/pages/blog/guest-ssid-on-spr) demonstrates this for residential setups. The strongest practical configuration. The implementation challenge: the AP needs to learn which VLAN a client belongs to as part of association, and the upstream router needs many VLAN trunks. Most consumer gear can't do this; some enterprise gear can (NDSS'26 §VIII-C).

## Firewall rules to layer on top

Per the paper (NDSS'26 §VIII-C; README §6.4), the firewall ruleset has to enforce:

- **No L2 forwarding between VLANs** (handled by the bridge / VLAN-aware switch).
- **No L3 forwarding between VLANs unless explicitly allowed.** Default deny.
- **No broadcast forwarding between VLANs.** Per-VLAN broadcast scopes.
- Critically: **the L3 rule must match what the L2 rule says.** AirSnitch's gateway-bouncing attack was the embodiment of "L2 isolation without matching L3 isolation". VLANs without router-side rules give you the same gap one level up.

## Combine with `gtk-per-vlan`

If your gear supports unique GTK per VLAN, enable it. Otherwise [GTK abuse](/wiki/attacks/abusing-gtk/) within the guest VLAN still works against other guests. Better still: per-client randomized GTK across the board (see [group key randomization](/wiki/defenses/group-key-randomization/)).

## Vendor support spot-checks

(NDSS'26 §VII-D, §VIII-C.)

- TP-Link EAP613 — supports per-BSSID VLAN; verified to nullify the AirSnitch attacks in this configuration.
- Cambium — `gtk-per-vlan` option.
- DD-WRT v3.0-r44715 — splits guest BSSID onto a separate Linux bridge by default; equivalent to per-bridge VLANs at the local-AP level (blocks port stealing).
- OpenWrt 24.10 — same default (separate bridge per BSSID).
- Most consumer all-in-one routers — limited or no VLAN support. Workaround: drop-in a separate dumb AP for guests, isolated by router firewall rules.

## How to test

After enabling VLANs, re-run the AirSnitch test suite. You should see:

```
>>> Client to client traffic at IP layer is NOT allowed
>>> Downlink port stealing is NOT successful
>>> Broadcast Reflection is NOT allowed
```

If any test still reports vulnerable, the VLAN isolation has a gap (likely a firewall rule, or a missing router-side L3 ACL).

## See also

- [Group key randomization](/wiki/defenses/group-key-randomization/) — the encryption-layer counterpart.
- [Spoofing prevention](/wiki/defenses/spoofing-prevention/) — additional belt to the VLAN braces.
- [MACsec](/wiki/defenses/macsec/) — when VLANs alone aren't enough.
- [airsnitch.py CLI](/wiki/tools/airsnitch-cli/) — how to run the verification tests.
