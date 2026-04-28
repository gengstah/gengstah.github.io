---
title: Setup Scripts and the Simulated Testbed
permalink: /wiki/airsnitch/tools/setup-scripts/
layout: single
author_profile: true
tags:
- airsnitch
- tool
sources:
- airsnitch-readme
- ndss2026-paper
updated: 2026-04-28
---

# Setup Scripts and the Simulated Testbed

How to reproduce the attacks **without buying a vulnerable router**. The repo includes scripts under [`setup/`](../../airsnitch/setup/) and the artifact appendix (NDSS'26 Appendix A) walks through three end-to-end reproductions — one per primary attack — using Linux's `mac80211_hwsim` driver to fake several Wi-Fi NICs on a single host.

## The pieces

```
airsnitch/setup/
├── setup-hwsim.sh                         # set up N simulated wireless NICs
├── setup-br0-gtkabuse.sh                  # bring up vulnerable AP for GTK abuse repro
├── setup-br0-gwbounce.sh                  # bring up vulnerable AP for gateway bouncing repro
├── setup-br0-portsteal.sh                 # bring up vulnerable AP for port stealing repro
├── load-config.sh
├── pysetup.sh
├── hostapd-wpa2-personal.conf             # ← target AP-side configs
├── hostapd-wpa2-personal-AE.conf
├── hostapd-wpa2-personal-ft.conf
├── hostapd-wpa3-personal.conf
├── hostapd-wpa3-personal-AE.conf
├── hostapd-wpa3-personal-pmf.conf
├── hostapd-wpa3-personal-pmf-bw.conf
├── supplicant-wpa2-personal.conf          # ← victim/attacker-side configs
├── supplicant-wpa2-personal-ft.conf
├── supplicant-wpa3-personal.conf
├── supplicant-wpa3-personal-pmf.conf
└── requirements.txt
```

`hostapd.conf` and `supplicant.conf` are symlinks to the WPA2-Personal variants by default.

## How the test topology works

Each `setup-br0-*.sh` script:

1. Calls `setup-hwsim.sh` to create simulated NICs (typically `wlan0`, `wlan1` for two simulated APs and `wlan2`, `wlan3` for the simulated victim and attacker).
2. Spawns `hostapd` instances on `wlan0` / `wlan1` using one of the `hostapd-*.conf` configs, configured to be **vulnerable to the specific attack**.
3. Bridges the AP-side NICs into a `br0` bridge with the right gateway-spoofing / port-learning behaviour.

The result: a fully local Wi-Fi environment where AirSnitch's tests can exercise the attack against a known-vulnerable AP. No physical radios required, no permission concerns — the simulated NICs are loopback within `mac80211_hwsim`.

## The three artifact-evaluation flows

From NDSS'26 Appendix A. Each is a small recipe; reproduce in order to verify the toolchain works on a fresh Ubuntu 22.04.5 LTS install.

### E1: Gateway Bouncing

```
# Window A
./setup-br0-gwbounce.sh

# Window B
python3 macstealer.py wlan2 --c2c-ip wlan3 --other-bss --no-ssid-check \
        --config client-simulated-AE-gatewaybouncing.conf
```

(The harness binary in the artifact appendix is named `macstealer.py`; in the upstream repo it's `airsnitch.py`. Same code, different name.)

Expected:

```
>>> Client to client traffic at IP layer is allowed (PSK{passphrase_atkr} to SAE{passphrase_victim}).
```

### E2: Port Stealing

```
./setup-br0-portsteal.sh
python3 macstealer.py wlan2 --c2c-port-steal wlan3 --other-bss --no-ssid-check \
        --config client-simulated-AE-portsteal.conf --server 192.168.100.1
```

Expected:

```
>>> Downlink port stealing is successful.
```

### E3: Abusing GTK

Two sub-cases — one for the victim BSSID, one for the attacker BSSID:

```
./setup-br0-gtkabuse.sh

python3 macstealer.py wlan2 --c2c-gtk-inject wlan3 --other-bss --no-ssid-check \
        --config client-simulated-AE-gtkabuse.conf --no-id-check --c2m-mon-channel 6
# >>> GTK wrapping ICMP ping is allowed (SAE{passphrase_victim} to SAE{passphrase_victim}).

python3 macstealer.py wlan2 --c2c-gtk-inject wlan3 --other-bss --no-ssid-check \
        --config client-simulated-AE-gtkabuse2.conf --no-id-check --c2m-mon-channel 1
# >>> GTK wrapping ICMP ping is allowed (PSK{passphrase_atkr} to PSK{passphrase_atkr}).
```

> **Note:** The `--c2c-gtk-inject` test requires `drop_unicast_in_l2_multicast=0` on the test machine because the simulated victim is itself a Linux client and the script monitors its managed interface. Set the sysctl back to 1 after testing. (README §7.) See [Filter unicast in broadcast](/wiki/airsnitch/defenses/filter-unicast-in-broadcast/).

## Mapping `setup-br0-*.sh` to attacks

| Script | Attack | Page |
| --- | --- | --- |
| `setup-br0-gtkabuse.sh` | [Abusing GTK](/wiki/airsnitch/attacks/abusing-gtk/) | |
| `setup-br0-gwbounce.sh` | [Gateway Bouncing](/wiki/airsnitch/attacks/gateway-bouncing/) | |
| `setup-br0-portsteal.sh` | [Port Stealing](/wiki/airsnitch/attacks/port-stealing/) | |

The remaining attacks ([Broadcast Reflection](/wiki/airsnitch/attacks/broadcast-reflection/), [Machine-on-the-side](/wiki/airsnitch/attacks/machine-on-the-side/), [Rogue AP](/wiki/airsnitch/attacks/rogue-ap/), [Passpoint flaws](/wiki/airsnitch/attacks/passpoint-flaws/)) don't ship a one-shot bring-up script; reproduce them by editing the existing `hostapd-*.conf` files (e.g. enabling FT or shared GTK rotation) and running the corresponding `airsnitch.py` test.

## Recon helper

`recon/recon_bssid_clients.sh` is a small `airodump-ng`-based scanner — list BSSIDs, MACs of associated clients, and channels in a target environment. Useful before pointing AirSnitch at a network you don't fully know. See [`recon/`](../../airsnitch/recon/).

## Server-triggered port restoration helpers

`server_triggered_port_restoration/server_pong.py` and `client_ping.py` implement the trick used in [auxiliary techniques](/wiki/airsnitch/attacks/auxiliary-techniques/#server-triggered) — a fixed-cadence ping/pong between an attacker-controlled server and a client to force periodic re-learning of the gateway MAC.

## See also

- [airsnitch.py CLI](/wiki/airsnitch/tools/airsnitch-cli/)
- [Configuration files](/wiki/airsnitch/tools/configurations/)
- [Repo layout](/wiki/airsnitch/tools/repo-layout/)
