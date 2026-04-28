---
title: "AirSnitch \u2014 Repository Layout"
permalink: /wiki/airsnitch/tools/repo-layout/
layout: single
author_profile: true
tags:
- airsnitch
- tool
sources:
- airsnitch-readme
updated: 2026-04-28
---

What lives where in [`airsnitch/`](../../airsnitch/). The repo is the upstream [`vanhoefm/airsnitch`](https://github.com/vanhoefm/airsnitch); the NDSS'26 artifact-evaluated snapshot is at [`zhouxinan/airsnitch`](https://github.com/zhouxinan/airsnitch) / [Zenodo](https://doi.org/10.5281/zenodo.17905485).

## Top-level

```
airsnitch/
├── README.md                       # primary docs (we ingest this)
├── setup.sh                        # one-shot dependency / build entry point
├── airsnitch/                      # the modified hostap source tree
│   ├── research/                   # ★ where you actually run things
│   ├── hostapd/, wpa_supplicant/, src/, ...   # patched hostap
│   └── ...
├── dependencies/
│   ├── hostap_2_9/, hostap_2_10/   # vendored hostap source
│   ├── build.sh, README.md
│   └── wpaspy.py → hostap_2_10/wpaspy/wpaspy.py
├── library/                        # AirSnitch's runtime helpers (not the modified hostap)
│   ├── daemon.py                   # spawns / wraps a wpa_supplicant instance
│   ├── station.py                  # state machine for one simulated client
│   └── testcase.py                 # Trigger/Action primitives the tests are built from
├── recon/
│   └── recon_bssid_clients.sh      # quick BSSID / client recon helper
├── server_triggered_port_restoration/
│   ├── server_pong.py
│   └── client_ping.py              # see auxiliary techniques
├── setup/
│   ├── hostapd-*.conf              # AP-side test configs (WPA2/3, with FT, with MFP, ...)
│   ├── supplicant-*.conf           # client-side test configs
│   ├── setup-br0-*.sh              # one-shot bring-up of test topologies
│   ├── setup-hwsim.sh              # simulate Wi-Fi NICs with mac80211_hwsim
│   ├── load-config.sh
│   ├── pysetup.sh
│   └── requirements.txt
├── airsnitch.png, airsnitch-large.png   # logo
├── steal-uplink.png, steal-downlink.png # diagrams referenced from README
└── hostap.py                       # small Python wrapper around hostap binaries
```

## `airsnitch/research/` — what you run

The actual test harness:

```
airsnitch/research/
├── airsnitch.py                ★  the CLI; see [airsnitch-cli.md]
├── airsnitch_measure.py        ★  performance measurement runner (Table V)
├── client.conf                    sample wpa_supplicant config (PSK)
├── client-simulated-AE-gatewaybouncing.conf
├── client-simulated-AE-gtkabuse.conf
├── client-simulated-AE-gtkabuse2.conf
├── client-simulated-AE-portsteal.conf
├── eap.conf                       sample WPA2-Enterprise config
├── multipsk.conf                  sample multi-PSK config
├── saepk.conf                     sample SAE-PK config
├── build.sh
├── pysetup.sh
├── run_every_2min.sh
├── requirements.txt
├── libwifi/                       vendored libwifi helpers
└── wpaspy.py                      symlink to dependencies/wpaspy
```

See [configuration files](/wiki/airsnitch/tools/configurations/) for what each `.conf` is for.

## `library/` — the test framework {#library}

Three files describe AirSnitch's own runtime model:

- **[`daemon.py`](../../airsnitch/library/daemon.py)** — wraps one `wpa_supplicant` instance, including the named-pipe (`wpaspy_ctrl`) the harness uses to drive it. One Daemon per simulated party.
- **[`station.py`](../../airsnitch/library/station.py)** — a per-NIC state machine (398 lines). Drives association, captures handshake state, and exposes the hooks each test plugs into.
- **[`testcase.py`](../../airsnitch/library/testcase.py)** — the small declarative DSL used by the tests:
  - `Trigger`: `NoTrigger`, `AfterAuth`, `Received`, `Associated`, `Connected`, `Disconnected`.
  - `Action`: `NoAction`, `GetIp`, `Reconnect`, `Inject`, `Function`, `Receive`, `Terminate`.

A test in `airsnitch.py` typically constructs a list of `(Trigger, Action)` pairs that fire as the supplicant state advances.

## `setup/` — bring-up helpers

The `setup-br0-*.sh` scripts simulate a vulnerable AP on the same machine using `mac80211_hwsim`. Three are referenced in the artifact appendix (NDSS'26 Appendix A, README §3 implicit):

- `setup-br0-gtkabuse.sh` — vulnerable to [Abusing GTK](/wiki/airsnitch/attacks/abusing-gtk/)
- `setup-br0-gwbounce.sh` — vulnerable to [Gateway Bouncing](/wiki/airsnitch/attacks/gateway-bouncing/)
- `setup-br0-portsteal.sh` — vulnerable to [Port Stealing](/wiki/airsnitch/attacks/port-stealing/)

These sit alongside `setup-hwsim.sh` which sets up the simulated radios. They are how you reproduce the attacks without hardware. See [setup scripts](/wiki/airsnitch/tools/setup-scripts/).

## `dependencies/` — the modified hostap

Two pinned versions of `hostap` (the upstream `hostapd` + `wpa_supplicant` source tree): 2.9 and 2.10. AirSnitch's modifications live here; `setup.sh` builds them.

## See also

- [airsnitch.py CLI](/wiki/airsnitch/tools/airsnitch-cli/)
- [Configuration files](/wiki/airsnitch/tools/configurations/)
- [Setup scripts](/wiki/airsnitch/tools/setup-scripts/)
- Upstream README: [`airsnitch/README.md`](../../airsnitch/README.md)
