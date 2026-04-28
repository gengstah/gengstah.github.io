---
title: Auxiliary Techniques (Port Restoration, Inter-NIC Relaying)
permalink: /wiki/airsnitch/attacks/auxiliary-techniques/
layout: single
author_profile: true
tags:
- airsnitch
- wifi
- attack
sources:
- ndss2026-paper
updated: 2026-04-28
---

# Auxiliary Techniques

> Layer: **Internal switching** · Section: **NDSS'26 §VI-A, §VII-G**

The primary attacks ([port stealing](/wiki/airsnitch/attacks/port-stealing/), [gateway bouncing](/wiki/airsnitch/attacks/gateway-bouncing/), [GTK abuse](/wiki/airsnitch/attacks/abusing-gtk/), [broadcast reflection](/wiki/airsnitch/attacks/broadcast-reflection/)) intercept or inject. Turning that into a **stable bidirectional MitM** — without the victim noticing the network is broken — needs three helper primitives. None of them is independently interesting, but without them the MitM is unstable: the victim disconnects, retries, the attack falls over.

## The challenge they solve

Port stealing poisons the bridge's FDB to point a MAC at the attacker's port. Whenever the **legitimate owner of that MAC** sends a frame, the bridge re-learns and the attacker loses control. To keep stealing the victim's downlink traffic, the attacker must keep injecting "I am the victim" frames continuously. To keep stealing the victim's uplink traffic, the attacker must keep injecting "I am the gateway" frames.

But to also *forward* intercepted traffic back where it belongs, the attacker periodically needs the FDB to point at the right place — the gateway's real port for outbound, the victim's real port for inbound. The auxiliary techniques are how the attacker quickly toggles between "stolen" and "restored" without dropping the victim.

## Server-Triggered Port Restoration {#server-triggered}

> Goal: while doing [uplink port stealing](/wiki/airsnitch/attacks/port-stealing/#uplink), briefly restore the gateway's MAC→port mapping so intercepted uplink traffic can be forwarded upstream.

The attacker pre-arranges with an attacker-controlled server on the Internet a fixed-cadence "ping" schedule. Every ~100 ms the server sends a burst of packets back across the gateway. The gateway's MAC appears as the source on those packets, the bridge's FDB re-learns `gateway MAC → uplink port`, and the attacker has a brief window in which the wired uplink is real again. During that window the attacker forwards their queued buffered uplink traffic upstream. Then the attacker resumes spoofing the gateway's MAC, the FDB swings back to the attacker's port, interception resumes.

(NDSS'26 §VI-A "Returning intercepted uplink traffic back to the gateway with server-triggered port restoration".)

The pre-arrangement is what gives this technique its name: the *server* triggers the port restoration on a known schedule, so the attacker doesn't have to wait for organic gateway-side traffic.

The repo includes a minimal helper at [`server_triggered_port_restoration/server_pong.py`](../../airsnitch/server_triggered_port_restoration/server_pong.py) and [`client_ping.py`](../../airsnitch/server_triggered_port_restoration/client_ping.py).

## Client-Triggered Port Restoration {#client-triggered}

> Goal: while doing [downlink port stealing](/wiki/airsnitch/attacks/port-stealing/#downlink), briefly restore the victim's MAC→port mapping so intercepted downlink traffic can be reinjected to the victim.

The dual problem: to deliver an intercepted packet back to the victim via [gateway bouncing](/wiki/airsnitch/attacks/gateway-bouncing/), the bridge's FDB needs `victim MAC → victim's port`. While the attacker is stealing the port, this isn't true.

Instead of waiting for the victim to send organic uplink traffic, the attacker actively elicits it. The attacker sends a **GTK-encrypted unicast ICMP Echo Request** to the victim. The victim sends an Echo Reply, which travels through its real BSSID. The bridge re-learns. The attacker then has a window to gateway-bounce the queued downlink packet.

(NDSS'26 §VI-A "Client-triggered port restoration".)

This stacks GTK abuse with port stealing inside the same attack and is one reason GTK abuse remains useful even when alternatives like Broadcast Reflection exist.

## Inter-NIC Relaying {#inter-nic}

> Goal: when the attacker uses *two NICs* — one spoofing the gateway MAC, one with a random MAC — coordinate them so packets queued on the gateway-spoofing NIC get forwarded out the random-MAC NIC at the right moment.

Practically, the attack chain in §VII-G runs:

```
NIC1 (gateway MAC)  ── intercepts victim's uplink frames
NIC2 (random MAC)   ── doing server-triggered port restoration
                       to keep gateway MAC mappable to its real port

When the bridge briefly maps gateway MAC → NIC2's port (via NIC2's
server-triggered restoration), the attacker:
  - relays buffered uplink frames internally NIC1 → NIC2,
  - retransmits them on NIC2 toward the bridge,
  - the bridge forwards them out the wired uplink to the real gateway.
```

So Inter-NIC Relaying is the local "switch" inside the attacker's hardware that bridges the two NICs at the right moment. It is what makes a clean, in-the-middle uplink path possible without dropping the victim.

(NDSS'26 §VII-G.)

## Putting them together

A bidirectional MitM on the same AP looks like:

1. NIC A: associate to a different BSSID with the **victim's MAC**, do [downlink port stealing](/wiki/airsnitch/attacks/port-stealing/#downlink) for victim's downlink.
2. NIC B: associate to a different BSSID with the **gateway's MAC**, do [uplink port stealing](/wiki/airsnitch/attacks/port-stealing/#uplink) for victim's uplink.
3. **Client-Triggered Port Restoration** every few hundred ms to reinject downlink to the victim via [gateway bouncing](/wiki/airsnitch/attacks/gateway-bouncing/) or [GTK abuse](/wiki/airsnitch/attacks/abusing-gtk/).
4. **Server-Triggered Port Restoration** every few hundred ms to forward uplink upstream, with **Inter-NIC Relaying** coordinating which NIC actually transmits.

For a victim watching YouTube on a Netgear R8000, the full attack starts within two seconds and produces no perceptible lag (NDSS'26 §VII-D, §VII-H Table V).

## What stops them

The auxiliary techniques themselves don't have direct mitigations — they just glue the primary attacks together. Defending against the primaries (separate bridges per BSSID, VLANs, MAC spoofing prevention, MACsec) defends against the helpers transitively. See [defences index](/wiki/airsnitch/defenses/index/).

## See also

- [Port stealing](/wiki/airsnitch/attacks/port-stealing/)
- [Gateway bouncing](/wiki/airsnitch/attacks/gateway-bouncing/), [GTK abuse](/wiki/airsnitch/attacks/abusing-gtk/), [Broadcast reflection](/wiki/airsnitch/attacks/broadcast-reflection/)
- [`server_triggered_port_restoration/`](../../airsnitch/server_triggered_port_restoration/) helper scripts in the repo
