---
title: arpgtk — ARP-over-GTK Auditor
permalink: /wiki/tools/arpgtk/
layout: single
author_profile: true
tags:
- wifi
- arp
- airsnitch
- tool
sources:
- arp-over-gtk-blog
updated: 2026-05-02
---

`arpgtk` is the diagnostic that pairs with the [ARP over GTK](/wiki/attacks/arp-over-gtk/) primitive. Source and build instructions: <https://github.com/gengstah/arpgtk>.

It is scoped tightly to two questions an admin actually needs answered:

1. Does the AP issue the same GTK to every associated client?
2. If yes, is a specific host on that SSID actually reachable via from-DS broadcasts, or does the AP suppress them at the medium?

Both checks run from a single associated client. Neither poisons anything.

## Pedigree

Built on the same primitives as AirSnitch: a patched `wpa_supplicant` for GTK extraction and Vanhoef's `libwifi` for CCMP construction. The novelty over AirSnitch's `--c2c-gtk-inject` is the inner payload (ARP instead of ICMP) and the framing of the result as a defence-audit tool rather than a research artefact. See [AirSnitch overview](/wiki/concepts/airsnitch-overview/) for the upstream context.

## Subcommands

### `--check-gtk-shared`

```
sudo arpgtk wlan2 --check-gtk-shared wlan3
```

Associates twice on two virtual managed interfaces (`wlan2` and `wlan3`) and byte-compares the GTKs each association receives.

- **Equal** → the AP shares one group key across clients. ARP-over-GTK is viable on this SSID; the network is exposed.
- **Unequal** → per-client GTK randomisation is in effect. The primitive is mitigated upstream and there is nothing useful to do at the over-the-air layer.

This is the same primitive [airsnitch.py --check-gtk-shared](/wiki/tools/airsnitch-cli/) runs.

### `--verify --target-ip IP`

```
sudo arpgtk wlan2 --verify --target-ip 192.168.1.42
```

Sends one CCMP-encrypted from-DS broadcast ARP request under the GTK, with a benign `169.254.x.x` requestor IP, and watches the managed iface for the bridged unicast reply.

- **Reply seen** → primitive viable against that target.
- **No reply** → the AP suppresses from-DS broadcasts at the medium (Proxy ARP / DGAF Disable / vendor knob) or the target is offline / firewalled.

The probe does not poison any cache: a target that records `(benign-link-local, our-mac)` as a side effect doesn't shadow any real host on the network. Safe to run on production networks during a defensive audit.

## What it doesn't do

`arpgtk` deliberately stops short of:

- **Bidirectional cache poisoning.** The auditing primitive is one-shot and benign-source.
- **Return-path NAT setup.** No `MASQUERADE`, no `ip_forward`, no traffic relay. The tool's job is to prove the primitive is viable, not to weaponise it.
- **Anything against networks the operator doesn't administer.** Use only on networks you own or are authorised to test.

## Operational notes

- Two NICs on the same `phy` are required: one managed (the legitimate association), one used internally as a monitor virtual interface for the injection.
- Drivers vary in their willingness to inject CCMP-encrypted frames on a monitor vif. The README documents tested drivers.
- The `--verify` probe needs the target to actually answer ARP for the requestor IP. Hosts with `arp_ignore=8` will not answer; that's a separate reachability question, not a primitive failure.

## Decision loop

After running both checks:

| `--check-gtk-shared` | `--verify` | What to do |
| --- | --- | --- |
| Unequal | n/a | Mitigated upstream. No further action needed. |
| Equal | No reply | Primitive viable in principle but the AP suppresses from-DS broadcasts. Confirm AP Proxy ARP / DGAF Disable is on. |
| Equal | Reply seen | Primitive viable. Enable per-client GTK / per-BSSID VLAN / endpoint hardening as appropriate. See [defences](/wiki/defenses/). |

That's the whole loop.

## See also

- [ARP over GTK](/wiki/attacks/arp-over-gtk/) — the primitive this tool audits.
- [Abusing GTK](/wiki/attacks/abusing-gtk/), [airsnitch.py CLI](/wiki/tools/airsnitch-cli/) — the upstream primitives.
- [Group key randomization](/wiki/defenses/group-key-randomization/), [Endpoint ARP hardening](/wiki/defenses/endpoint-arp-hardening/) — what to do once the audit comes back exposed.
- [Source — Router-side ARP defences blog post](/wiki/sources/blog/2026-05-02-arp-over-gtk/) — provenance.

## References

- [`gengstah/arpgtk`](https://github.com/gengstah/arpgtk) — source, README, build instructions.
- *Router-side ARP defenses don't catch what they don't see.* `gengstah.github.io`, 2026-05-02.
