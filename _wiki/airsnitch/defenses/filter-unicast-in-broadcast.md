---
title: Filtering Unicast IP in L2 Broadcast Frames
permalink: /wiki/airsnitch/defenses/filter-unicast-in-broadcast/
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

# Filtering Unicast IP in L2 Broadcast Frames

A small, OS-side defence against the data-plane endpoint of [GTK abuse](/wiki/airsnitch/attacks/abusing-gtk/), [Broadcast Reflection](/wiki/airsnitch/attacks/broadcast-reflection/), and the [Passpoint flaws](/wiki/airsnitch/attacks/passpoint-flaws/) attack chain.

The principle: when a kernel decrypts a Wi-Fi frame whose L2 destination is broadcast/multicast and finds a *unicast IP datagram* inside, **drop it**. There is no legitimate reason for the AP to broadcast a unicast IP packet to you.

(NDSS'26 §VIII-C; README §6.3.)

## How to enable it on Linux

```sh
sysctl -w net.ipv4.conf.all.drop_unicast_in_l2_multicast=1
sysctl -w net.ipv4.conf.default.drop_unicast_in_l2_multicast=1
```

Persist in `/etc/sysctl.conf` or `/etc/sysctl.d/99-wifi-hardening.conf`.

This is a per-interface sysctl with `all` / `default` / `<ifname>` variants. Documentation: [sysctl-explorer.net](https://sysctl-explorer.net/net/ipv4/drop_unicast_in_l2_multicast/).

## What it actually blocks

From NDSS'26 Table IV — even with `drop_unicast_in_l2_multicast=1`, Linux still:

- accepts **unicast IPv6 ping** inside L2 broadcast (no IPv6 equivalent of the sysctl);
- accepts **unicast ARP** inside L2 broadcast (the sysctl is IP-layer only);
- correctly drops **unicast IPv4 ping** inside L2 broadcast.

Windows 11 with firewall on rejects unicast IPv4 ping but accepts IPv6 ping and unicast ARP. macOS, iOS, and Android accept all three regardless of firewall settings.

So this defence is **incomplete** — it closes the IPv4 path on Linux only. On a typical mixed-OS network it will protect a fraction of clients on a fraction of address families. Worth turning on regardless.

## What it doesn't fix

- IPv6 traffic — still vulnerable.
- ARP-based attacks (e.g. malicious gratuitous ARP delivered as a broadcast frame).
- The full class of [Broadcast Reflection](/wiki/airsnitch/attacks/broadcast-reflection/) when the attacker uses IPv6 or ARP payloads.
- [Gateway Bouncing](/wiki/airsnitch/attacks/gateway-bouncing/), [Port Stealing](/wiki/airsnitch/attacks/port-stealing/), [Machine-on-the-side](/wiki/airsnitch/attacks/machine-on-the-side/), [Rogue AP](/wiki/airsnitch/attacks/rogue-ap/) — none touch this code path.

## Why it matters anyway

- Cheap. One sysctl. No risk of breaking legitimate traffic, since broadcasting unicast IPv4 is not a thing legitimate networks do.
- Defense-in-depth: even if an AP-side filter exists, an OS-side filter is independent of it.
- Cuts off the most common AirSnitch attack chain (`--c2c-gtk-inject` IPv4 case) for Linux clients.

## What kernels and vendors should do

- Add IPv6 equivalents (`net.ipv6.conf.*.drop_unicast_in_l2_multicast` or similar).
- Apply the same logic to ARP — refuse to update ARP cache from a broadcast-encapsulated ARP reply (this is closer to ARP-spoofing prevention).
- Default these to enabled on Wi-Fi interfaces at OS install time.

## Repo note

`--c2c-gtk-inject` has a dependency on this sysctl being **off** to work in the artifact-evaluation testbed. README §7 calls out:

> The test `--c2c-gtk-inject` relies on the Linux machine having set the sysctl `drop_unicast_in_l2_multicast` to `0`, since the simulated victim is a Linux client itself and the script monitors the managed interface for the injected frame.

This is an artefact of the test setup, not a sign the sysctl is harmful. Set it to 0 only when you're running the test, then back to 1 afterwards.

## See also

- [Abusing GTK](/wiki/airsnitch/attacks/abusing-gtk/)
- [Broadcast Reflection](/wiki/airsnitch/attacks/broadcast-reflection/)
- [Group key randomization](/wiki/airsnitch/defenses/group-key-randomization/) — the AP-side counterpart that closes the same attack at the source.
