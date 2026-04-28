---
title: Documentation and Warnings
permalink: /wiki/airsnitch/defenses/documentation/
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
---

# Documentation and Warnings

Not a technical defence. A *deployment* defence. The AirSnitch authors put it first in their list (README §6.1, NDSS'26 §VIII-C "Proper documentation") because **most insecure deployments are insecure because nobody knew what the feature actually did**.

The recurring failure mode in the NDSS'26 paper is: a vendor ships a "client isolation" checkbox; an admin enables it; the admin assumes guests can't reach main-network clients; in fact (depending on vendor), they can, via [gateway bouncing](/wiki/airsnitch/attacks/gateway-bouncing/) or [port stealing](/wiki/airsnitch/attacks/port-stealing/) or [GTK abuse](/wiki/airsnitch/attacks/abusing-gtk/). The fix isn't always more crypto. Sometimes the fix is *the vendor stating clearly which traffic the checkbox blocks*.

## What vendors should document

For any product with a "client isolation", "AP isolation", "guest network", or "P2P blocking" setting, the docs should answer (README §6.1):

1. **Are clients in the guest network allowed to communicate with each other?** ([Intra-BSSID isolation](/wiki/airsnitch/concepts/client-isolation/).)
2. **Is traffic allowed between the guest and main network? In which direction?** Per [gateway bouncing](/wiki/airsnitch/attacks/gateway-bouncing/) and [port stealing](/wiki/airsnitch/attacks/port-stealing/), the answer is often "yes, despite the setting".
3. **Are wired devices isolated from each other and from Wi-Fi clients?** Often forgotten. Wired PCs on a NAS share are usually not subject to the wireless client isolation rules.
4. **Optionally: is there isolation between devices of the same user?** PPSK and per-EAP-identity setups need to be explicit about whether a user's tablet is isolated from their laptop.

Concretely, this is a published table per product, not a sentence in the GUI tooltip.

## What vendors should warn about

(NDSS'26 §VIII-C "Warnings"; README §6.8.)

- **When client isolation is enabled on an open network, or a network with a shared WPA2-PSK or WPA3-SAE password**, display a warning that this provides no security benefit against a determined insider — see [machine-on-the-side](/wiki/airsnitch/attacks/machine-on-the-side/) and [rogue AP](/wiki/airsnitch/attacks/rogue-ap/). Vendors marketing client isolation as a security feature on home WPA2-PSK networks are misleading their users.
- **When a guest network is enabled, prompt for whether to also isolate guests from each other.** Most users want guest-to-main isolation but don't think about guest-to-guest until the day after their houseguest's compromised laptop hits the smart bulbs.
- **When MAC randomization is detected on a network using a MAC allow-list**, warn that the allow-list will fight the randomization.

## Why this is a defence

A network admin who knows that client isolation does not block [gateway bouncing](/wiki/airsnitch/attacks/gateway-bouncing/) on their hardware will (a) not rely on it as the sole control, and (b) put VLANs and firewall rules in place. A network admin who doesn't know will trust the checkbox. The blast radius of an attack scales with the gap between *what the admin thinks is true* and *what is true*.

## Operational consequences

- Procurement teams should ask: "What does your client isolation feature actually block? Show me the threat model."
- Auditors should treat "client isolation: ✓" without supporting documentation as no-op.
- Whoever runs the network should periodically run [`airsnitch.py`](/wiki/airsnitch/tools/airsnitch-cli/) against their own deployment. The output is the actual answer to the documentation questions above.

## Standardisation

The deeper fix the authors recommend (NDSS'26 §VIII-C closing): **standardise client isolation**. IEEE 802.11 should specify which traffic patterns must be blocked, in which direction, between which pairs of clients, and how to verify it. Without that, every vendor will keep shipping their own incomplete implementation.

## See also

- [Defences index](/wiki/airsnitch/defenses/index/)
- [Tested devices](/wiki/airsnitch/devices/tested-devices/) — what each tested vendor actually documents.
