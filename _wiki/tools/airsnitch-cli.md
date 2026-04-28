---
title: airsnitch.py — CLI Reference
permalink: /wiki/tools/airsnitch-cli/
layout: single
author_profile: true
tags:
- airsnitch
- tool
sources:
- airsnitch-readme
updated: 2026-04-28
redirect_from:
- /wiki/tools/airsnitch-cli/
---

`airsnitch.py` is the central executable. Lives at `airsnitch/research/airsnitch.py` in the upstream repo. It runs two `wpa_supplicant` instances (the simulated victim and attacker) against the target network, then drives the chosen test through helpers in `library/`.

```
sudo ./airsnitch.py <iface> [test flag] [other-iface] [common options]
```

The first positional `<iface>` is the victim's NIC; whichever test flag is used takes the attacker's NIC as its argument. Two NICs minimum (one per simulated party); some attacks need a third for relay.

## Common options

| Option | Purpose |
| --- | --- |
| `--config <file>` | Path to the supplicant config (default `client.conf`). See [configuration files](/wiki/tools/configurations/). |
| `--server <ip>` | A reachable IP for ping/iperf during certain tests (default `8.8.8.8`). |
| `--same-bss` / `--other-bss` | Force victim and attacker onto the same / different BSSID. Required unless `bssid=` is set in both network blocks of the config. |
| `--no-ssid-check` | Allow the victim and attacker network blocks to have different SSIDs. Use whenever testing isolation between two named networks (e.g. `Guest` vs `Main`). |
| `--same-id` / `--flip-id` | Reconnect using the victim's identity / swap victim and attacker identities. |
| `--no-id-warning` | Suppress the warning when victim and attacker share an EAP identity. |
| `-d`, `--debug` | Increase verbosity. `-dd` for full `wpa_supplicant` debug. |
| `--ping` | Ping `--server` after association to verify connectivity. |
| `--delay <s>` | Wait before reconnecting as the attacker. |
| `--pmk-file [path]` | Cache PMKSAs to disk to skip re-authentication on repeated runs. |

## Test flags

Each test takes a second NIC as its argument and runs a specific [attack](../attacks/) end-to-end.

| Flag | Attack | Page |
| --- | --- | --- |
| `--check-gtk-shared <iface2>` | Verify whether victim and attacker receive the same GTK | [Abusing GTK](/wiki/attacks/abusing-gtk/) |
| `--c2c-gtk-inject <iface2>` | Inject a unicast IP packet wrapped in a GTK-encrypted broadcast frame | [Abusing GTK](/wiki/attacks/abusing-gtk/) |
| `--c2c-broadcast <iface2>` | Test [Broadcast Reflection](/wiki/attacks/broadcast-reflection/) (`ToDS=1, addr3=ff:ff:..`) | [Broadcast Reflection](/wiki/attacks/broadcast-reflection/) |
| `--c2c-ip <iface2>` | Test [Gateway Bouncing](/wiki/attacks/gateway-bouncing/) (L3 client-to-client) | [Gateway Bouncing](/wiki/attacks/gateway-bouncing/) |
| `--c2c-eth <iface2>` | Direct L2 client-to-client traffic (baseline / sanity check) | [Client isolation concept](/wiki/concepts/client-isolation/) |
| `--c2c <iface2>` | ARP-based client-to-client (legacy ARP poisoning baseline) | [Client isolation concept](/wiki/concepts/client-isolation/) |
| `--c2c-port-steal <iface2>` | Test [downlink port stealing](/wiki/attacks/port-stealing/#downlink) | [Port Stealing](/wiki/attacks/port-stealing/) |
| `--c2c-port-steal-uplink <iface2>` | Test [uplink port stealing](/wiki/attacks/port-stealing/#uplink) | [Port Stealing](/wiki/attacks/port-stealing/) |
| `--c2m <iface2>` | Client-to-monitor: stage interface in monitor mode and check what reaches it | (used to confirm leak-in-plaintext) |
| `--c2m-ip <iface2>` | L3 variant of `--c2m` | |
| `--c2m-mon-channel <chan>` | Channel for the monitor interface | required for `--c2m-*` |
| `--c2m-freq <hz>` | Frequency for monitor interface | alternative to `--c2m-mon-channel` |
| `--c2m-mon-output <file>` | pcap output for the monitor interface | |
| `--fast <iface2>` | "Fast override" attack | (advanced; rarely used) |

## Auxiliary / chaining flags

| Flag | Purpose |
| --- | --- |
| `--reinject-reflection` | After interception, return packets to the victim using [Broadcast Reflection](/wiki/attacks/broadcast-reflection/) |
| `--reinject-gtk <iface3>` | After interception, return packets using [GTK abuse](/wiki/attacks/abusing-gtk/) over a third NIC |
| `--c2c-pcap-output <file>` | Capture the attacker NIC's traffic to pcap (via `dumpcap`/`tcpdump`) |
| `--poc` | Attack a real client (for PoC purposes — only against own devices on own networks) |
| `--measure` | Measure attack performance metrics (used for §VII-H Table V) |

## iperf3 flags (for performance measurement)

`--iperf-target <ip>`, `--iperf-bandwidth <rate>` (default 100M), `--iperf-duration <s>` (default 10), `--iperf-port <port>` (default 5201). Used with `--measure`.

## Manual tests

README §5.3 lists items that aren't directly tested by the CLI yet:

- Whether the IGTK group key is randomized under client isolation. (See [Passpoint flaws](/wiki/attacks/passpoint-flaws/).)

These are manual verifications using protocol-level captures rather than dedicated AirSnitch CLI flags. Future versions may add them.

## Read-the-output guide

Each test prints a final line in red on success — that is, on **vulnerability detected**. Greppable patterns:

| Test | Vulnerable output |
| --- | --- |
| `--check-gtk-shared` | `>>> The victim's GTK is (...). >>> The attacker's GTK is (...)` (matching values) |
| `--c2c-gtk-inject` | `>>> GTK wrapping ICMP ping is allowed (...).` |
| `--c2c-ip` | `>>> Client to client traffic at IP layer is allowed (...).` |
| `--c2c-broadcast` | `>>> Broadcast Reflection is allowed (...).` |
| `--c2c-port-steal` | `>>> Downlink port stealing is successful.` |
| `--c2c-port-steal-uplink` | `>>> Uplink port stealing is successful.` |

## Permission

Run as root. The script needs to bring up `wpa_supplicant`, manage interfaces with `iw`, and inject raw 802.11 frames. From the README's usage notes:

```
sudo su
source venv/bin/activate
./airsnitch.py ...
```

## See also

- [Repo layout](/wiki/tools/repo-layout/)
- [Configuration files](/wiki/tools/configurations/)
- [Setup scripts](/wiki/tools/setup-scripts/)
- [Library internals](/wiki/tools/repo-layout/#library)
