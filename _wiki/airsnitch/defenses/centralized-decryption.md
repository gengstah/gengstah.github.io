---
title: Centralised Wi-Fi Decryption
permalink: /wiki/airsnitch/defenses/centralized-decryption/
layout: single
author_profile: true
tags:
- airsnitch
- wifi
- defense
sources:
- ndss2026-paper
updated: 2026-04-28
---

# Centralised Wi-Fi Decryption

In most APs, encryption terminates *at the AP*: PTK and GTK are held on the AP, decryption happens on the AP, the bridge handles cleartext, and the AP re-encrypts on egress. AirSnitch's [port stealing](/wiki/airsnitch/attacks/port-stealing/) and [broadcast reflection](/wiki/airsnitch/attacks/broadcast-reflection/) attacks exploit precisely this AP-local cleartext bridge.

**Centralised decryption** moves the boundary. Some enterprise wireless controllers (Cisco's CAPWAP DTLS, some Aruba designs) tunnel raw 802.11 frames from the AP to a central controller, where decryption and routing happen. The AP becomes a thin radio relay; the controller is the new "switch".

The AirSnitch authors note (NDSS'26 §VIII-C): *"Enterprise equipment may provide an option to let a central controller decrypt and route all Wi-Fi traffic. In our experiments, we found that this can make attacks harder."*

## What it changes

- The **AP-local bridge FDB** that port stealing poisons largely goes away — the AP doesn't bridge cleartext between BSSIDs.
- The **broadcast re-encryption logic** that broadcast reflection exploits also moves to the controller. Whether the controller is similarly vulnerable depends on its implementation.
- Cross-AP attacks via the [distribution switch](/wiki/airsnitch/concepts/virtual-ports/) become harder because the wired distribution path now carries opaque tunnels rather than plaintext Ethernet.

## What it doesn't change

- [Gateway Bouncing](/wiki/airsnitch/attacks/gateway-bouncing/) is still possible — the controller still has to route between subnets, and if the routing rules don't match the L2 isolation, gateway bouncing succeeds at the controller level.
- [GTK abuse](/wiki/airsnitch/attacks/abusing-gtk/) is independent — frames go over the air, not through the controller.
- [Machine-on-the-side](/wiki/airsnitch/attacks/machine-on-the-side/) and [Rogue AP](/wiki/airsnitch/attacks/rogue-ap/) are independent.
- Centralised decryption only helps if it's actually enabled. Many "controller-managed" deployments still terminate encryption at the AP for performance reasons (called "FlexConnect" or "local switching" in Cisco terminology).

## When to consider it

- Enterprise networks where the controller is already the source of truth.
- When [MACsec](/wiki/airsnitch/defenses/macsec/) at the client isn't deployable but you still want to take cleartext off the AP.
- When you want a single chokepoint for traffic inspection / DLP / IDS.

## Caveats

- Latency. Round-tripping every frame through a central controller adds delay and limits the per-AP capacity.
- The controller becomes a single point of failure. Operationally heavier than running APs autonomously.
- Some controllers terminate the tunnel at L3 (IP-in-IP) rather than L2; the boundary then moves but isn't fully central. Check your specific product.

## See also

- [Defences index](/wiki/airsnitch/defenses/index/)
- [Port stealing](/wiki/airsnitch/attacks/port-stealing/)
- [MACsec](/wiki/airsnitch/defenses/macsec/) — alternative for client-to-gateway protection.
