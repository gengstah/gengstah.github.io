---
title: Broadcast Reflection
permalink: /wiki/airsnitch/attacks/broadcast-reflection/
layout: single
author_profile: true
tags:
- airsnitch
- wifi
- attack
sources:
- ndss2026-paper
- airsnitch-readme
updated: 2026-04-28
---

> Layer: **Internal switching** · Section: **NDSS'26 §V-C** · CLI: `--c2c-broadcast`

## What it is

[Abusing GTK](/wiki/airsnitch/attacks/abusing-gtk/) requires the attacker to know the *victim's* GTK — the attacker has to associate to the same BSSID. Broadcast Reflection achieves the same outcome (deliver a unicast IP packet inside a GTK-encrypted broadcast Wi-Fi frame to the victim) **without ever knowing the victim's GTK**. The AP does the encryption, on the attacker's behalf, with the right key.

The trick: send a Wi-Fi frame from the attacker's BSSID with the special address layout

```
Dot11(FCfield = "to-DS",
      addr1   = <attacker's BSSID / AP receiver>,
      addr2   = <attacker's MAC>,
      addr3   = ff:ff:ff:ff:ff:ff)        # broadcast as the LOGICAL destination
  / IP(src = <attacker IP>, dst = <victim IP>)
```

The AP receives this on the attacker's virtual port. The L2 frame says "I'm being sent to the distribution system, with a broadcast logical destination". The AP dutifully:

1. Decrypts under the attacker's PTK.
2. Hands the cleartext to the bridge.
3. Sees the broadcast destination → schedules a re-encryption *as a broadcast* on every BSSID, including the victim's.
4. Re-encrypts under the **victim's BSSID's GTK** and emits.

The frame the victim receives is indistinguishable from a legitimate broadcast from its AP. The OS unwraps the embedded unicast IP, delivers it.

## Why it works

The AP can't tell — and the spec doesn't require it to tell — that a frame with `addr3 = ff:ff:..` carrying a unicast IP datagram is suspicious. The AP's bridge fans out broadcast traffic across all member ports, which is exactly its job. The attacker just exploits that to ride the victim BSSID's GTK without ever holding it.

This is also why the attack works **across BSSIDs and even across SSIDs** of the same AP. The attacker's BSSID can be open while the victim's is WPA3-Enterprise; the AP will still broadcast the cleartext (re-encrypted under the victim BSSID's GTK).

## Compared to Abusing GTK

| | [Abusing GTK](/wiki/airsnitch/attacks/abusing-gtk/) | Broadcast Reflection |
| --- | --- | --- |
| Needs victim's GTK | yes | **no** |
| Needs to be on victim's BSSID | yes | **no** |
| Needs the AP's cooperation | no | **yes** |
| Fixed by per-client randomized GTK on victim's BSSID | yes | yes (the AP re-encrypts under the victim's GTK, but if it's per-client unique, broadcasting is disabled) |
| Fixed by AP-side filter on `ToDS=1, addr3=ff:ff:..` carrying unicast IP | no | **yes** |

The two attacks share the same OS-level acceptance condition (unicast IP inside L2 broadcast — see [Wi-Fi key hierarchy → GTK](/wiki/airsnitch/concepts/wifi-key-hierarchy/#gtk--group-temporal-key) and Table IV).

## What it enables

- **Cross-BSSID injection without holding the victim's group keys.** The most common use.
- **Returning intercepted traffic in a downlink MitM** — same use case as gateway bouncing or direct GTK abuse, with weaker prerequisites (no association to the victim's BSSID required). See [auxiliary techniques](/wiki/airsnitch/attacks/auxiliary-techniques/).
- **Plaintext leaks through open SSIDs** — when the attacker's BSSID is open, the AP-side decryption above places cleartext on the bridge, where [downlink port stealing](/wiki/airsnitch/attacks/port-stealing/#downlink) can pick it up.

## CLI

```
./airsnitch.py wlan2 --c2c-broadcast --no-ssid-check [--other-bss | --same-bss]
```

Vulnerable output:

```
>>> Broadcast Reflection is allowed (PSK{pw_atkr} to SAE{pw_victim})
```

(README §5.1.)

## Coverage

NDSS'26 Table II shows Broadcast Reflection works against every tested device, including Cisco Catalyst 9130 in its enterprise mode. (The paper marks every cell ✓ for the M↔G and M↔M directions.)

## What stops it

- **Per-client randomized GTK on every BSSID** so there is effectively no broadcast capability for the AP to use; broadcast traffic gets unicasted via Proxy ARP. See [Group key randomization](/wiki/airsnitch/defenses/group-key-randomization/).
- **AP-side filter on `ToDS` frames whose `addr3 = ff:ff:ff:ff:ff:ff` carry unicast IP datagrams.** Cheap, vendor-deployable, but absent from all tested devices.
- **OS-level filter on unicast IP in L2 broadcast/multicast** (`drop_unicast_in_l2_multicast=1` on Linux). Only IPv4, and only blocks the data-plane endpoint of the attack.
- **MACsec** end-to-end with unique pairwise keys.

## See also

- [Abusing GTK](/wiki/airsnitch/attacks/abusing-gtk/) — the "direct" version of the same delivery pattern.
- [Auxiliary techniques](/wiki/airsnitch/attacks/auxiliary-techniques/) — how Broadcast Reflection is used to return intercepted packets.
- [Group key randomization](/wiki/airsnitch/defenses/group-key-randomization/)
