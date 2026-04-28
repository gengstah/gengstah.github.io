---
title: Configuration Files (client.conf, eap.conf, multipsk.conf, saepk.conf)
permalink: /wiki/tools/configurations/
layout: single
author_profile: true
tags:
- airsnitch
- tool
sources:
- airsnitch-readme
updated: 2026-04-28
redirect_from:
- /wiki/tools/configurations/
---

# Configuration Files

AirSnitch drives `wpa_supplicant` via configuration files. The convention: **every config defines two `network={}` blocks**, one with `id_str="victim"` and one with `id_str="attacker"`. The harness uses those IDs to select which credentials to use for which simulated party.

(README §3.2.)

## Required first line

```
ctrl_interface=wpaspy_ctrl
```

`hostap.py` and the daemon helpers depend on this — don't change it. It's the named-pipe `wpa_supplicant` listens on so AirSnitch can issue commands.

## The four shipped templates

### `client.conf` — WPA2-PSK / WPA3-SAE (default)

```
ctrl_interface=wpaspy_ctrl

network={
    id_str="victim"
    ssid="main-network"
    key_mgmt=WPA-PSK
    psk="main-password"
}
network={
    id_str="attacker"
    ssid="guest-network"
    key_mgmt=WPA-PSK
    psk="guest-password"
}
```

The default. Shared-passphrase attacks (Personal-mode networks). When victim and attacker share an SSID and password, you're testing intra-network isolation. When they differ (as above), you're testing isolation between separate networks (e.g. main vs guest).

To test WPA3-SAE, change `key_mgmt=WPA-PSK` to `key_mgmt=SAE` and add `ieee80211w=2`. WPA3-Personal mandates [MFP](/wiki/concepts/mfp/), so `ieee80211w=2`.

### `eap.conf` — WPA2/3-Enterprise (PEAP-MSCHAPv2)

For testing Enterprise networks. Two blocks with different EAP usernames and passwords:

```
network={
    id_str="victim"
    ssid="enterprise-network"
    key_mgmt=WPA-EAP
    eap=PEAP
    identity="alice"
    password="alice-password"
    phase2="auth=MSCHAPV2"
}
network={
    id_str="attacker"
    ssid="enterprise-network"
    key_mgmt=WPA-EAP
    eap=PEAP
    identity="bob"
    password="bob-password"
    phase2="auth=MSCHAPV2"
}
```

This is how you confirm that attacks like [GTK abuse](/wiki/attacks/abusing-gtk/), [Gateway Bouncing](/wiki/attacks/gateway-bouncing/), and [Port Stealing](/wiki/attacks/port-stealing/) work even when the victim and attacker have **different EAP identities** with their own credentials. (NDSS'26's two real-university tests in §VII-F exercise exactly this case.)

### `multipsk.conf` — Multi-PSK / per-device passphrases

For networks that issue different passphrases to different users while exposing a single SSID (e.g. via the `wpa_psk_file` mechanism in `hostapd`). Tests whether per-user passphrases provide actual isolation. Often the answer is "only at the encryption layer, not at switching".

### `saepk.conf` — WPA3 Public Key (SAE-PK)

For [WPA3-PK](/wiki/concepts/wpa-versions/#wpa3-pk-wpa3-public-key) public-hotspot mode. Useful for confirming that *encryption*-layer attacks (machine-on-the-side, rogue AP) are blocked but *switching*-layer attacks are not.

## Specifying a particular AP

By default, AirSnitch picks any AP/BSS that matches the SSID. To pin to a specific BSSID — useful when you want to test a particular AP in a multi-AP environment — add a `bssid=` field inside the network block:

```
network={
    id_str="victim"
    ssid="main-network"
    key_mgmt=WPA-PSK
    psk="main-password"
    bssid=00:11:22:33:44:55
}
```

(README §5.2.)

If you specify `bssid=` in both victim and attacker blocks, AirSnitch can determine same-vs-different-BSS automatically and you don't strictly need `--same-bss` / `--other-bss` (though it's clearer to include them).

## Choosing the config at runtime

```
./airsnitch.py wlan2 --c2c-ip wlan3 --no-ssid-check --other-bss --config eap.conf
```

The default is `client.conf`. The four templates exist so you can copy and edit; nothing forces you to use those exact filenames.

## When victim and attacker share `id_str`

Don't. The harness checks for this and warns. Override with `--no-id-warning` only if you know what you're doing — e.g. testing a network that genuinely uses one shared identity for everyone (not common; uncommonly secure).

## See also

- [airsnitch.py CLI](/wiki/tools/airsnitch-cli/) — the runtime that consumes these configs.
- [WPA versions](/wiki/concepts/wpa-versions/) — what each mode means.
- [Configuration testing notes from the AirSnitch artifact appendix](../../raw/ndss2026-airsnitch-paper.md#appendix) — also documents `client-simulated-AE-*.conf` variants used by `setup-br0-*.sh`.
