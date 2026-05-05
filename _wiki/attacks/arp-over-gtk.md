---
title: ARP over GTK — Bypassing Router-Side ARP Defences on Wi-Fi
permalink: /wiki/attacks/arp-over-gtk/
layout: single
author_profile: true
tags:
- airsnitch
- wifi
- arp
- attack
sources:
- arp-over-gtk-blog
- ndss2026-paper
- airsnitch-readme
updated: 2026-05-02
---

> Layer: **Wi-Fi encryption + L2** · Source: **`/posts/2026/05/arp-over-gtk/`** · Tool: **`arpgtk`**

## What it is

A specific instantiation of the [Abusing GTK](/wiki/attacks/abusing-gtk/) injection envelope where the inner payload is an [ARP](/wiki/concepts/arp/) frame instead of an ICMP echo or generic IP packet. The result is the smallest object that simultaneously:

1. **Bypasses every router-side ARP defence** that operates on the AP's bridge — [Dynamic ARP Inspection](/wiki/defenses/dynamic-arp-inspection/), DHCP-snooping ARP filtering, IP-MAC binding, `ebtables`/`arptables` on `br-lan`, MikroTik `arp=reply-only`, UniFi "ARP cache poisoning protection" — because the frame does not cross the bridge in the first place.
2. **Updates the victim's ARP cache anyway**, because the victim's NIC accepts the frame as a legitimate group-encrypted broadcast from the AP, decrypts at MLME, and hands the inner LLC/ARP up to the IP stack, which processes it as it would any other ARP.

The contribution is structural, not cryptographic: the CCMP construction is the same one [AirSnitch](/wiki/concepts/airsnitch-overview/) uses, the frame format is the same, the GTK extraction goes through the same patched `wpa_supplicant`. AirSnitch already implements both halves separately — `--c2c-gtk-inject` (GTK-encrypted broadcast injection with an ICMP payload) and a classic to-DS bridge-side ARP test. Combining them into a from-DS GTK-encrypted broadcast carrying an ARP payload is what bypasses the entire router-side ARP defence family.

## The frame

```
RadioTap()
 / Dot11(type=Data, subtype=QoS-Data,
         FCfield=from-DS|protected,
         addr1=ff:ff:ff:ff:ff:ff,    # broadcast destination
         addr2=<AP BSSID>,           # transmitter is "the AP"
         addr3=ff:ff:ff:ff:ff:ff)
 / Dot11QoS(TID=0)
 / Dot11CCMP(PN=<one ahead of AP>, key_id=<gtk_idx>)
 / <CCMP-encrypted: LLC()/SNAP(0x0806)/ARP(...)>
```

ARP payload:

```
ARP(op=2,                                # reply
    psrc=<IP being claimed; usually gateway>,
    hwsrc=<attacker MAC>,
    pdst=<victim IP>,
    hwdst=<victim MAC>)
```

Encrypt under the shared GTK (NDSS'26 §III). PN one above the AP's last broadcast, so receivers' replay window accepts it. Inject on a monitor virtual interface on the same `phy` as the associated managed interface.

Every other client on that BSSID sees a legitimate AP broadcast. The kernel hands the inner LLC/ARP up the stack. The victim's ARP cache updates. Done.

## Path the frame takes

Radio out of the attacker's NIC, radio into the victim's NIC. That's it. The AP's bridge does not see this frame. It was never on the bridge. It was never anywhere except the air between two stations. This is the architectural fact that makes router-side ARP defences architecturally a no-op.

You can verify on OpenWrt by running `tcpdump -i br-lan arp` while the attack runs. Legitimate ARP traffic shows up on the bridge. The injected frame does not.

## Why it works

Three reinforcing facts (the same three that underpin [Abusing GTK](/wiki/attacks/abusing-gtk/)):

1. **The GTK is shared by default** on WPA2-PSK / WPA3-SAE / Enterprise unless per-client randomisation is in effect. One legitimate association on the BSSID gives the attacker the same key the AP uses to broadcast.
2. **Receivers cannot tell whether a from-DS broadcast came from the legitimate AP or from another client encrypting under the GTK.** `addr2` says the AP. The CCMP MIC verifies under a key both parties share. There is no spec-mandated check that says "the AP didn't actually send this."
3. **The AP's bridge is not in the conversation.** The bridge is the single chokepoint where router-side defences live. Frames that travel station-to-station over the air bypass it.

## Defences that don't fire

(The list of router-side knobs admins reach for first, with one-line reasons for each non-firing.)

| Defence | Why it doesn't fire |
| --- | --- |
| **[Cisco DAI](/wiki/defenses/dynamic-arp-inspection/) on the wired switch** | Frame is never on a wired switchport. |
| **DHCP-snooping ARP filter on the AP / router (`br-lan` netfilter, `ebtables`, `arptables`)** | Hooks fire on frames crossing the bridge. The frame doesn't cross the bridge. |
| **IP-MAC binding (TP-Link, MikroTik, others)** | Same architecture as DHCP-snooping ARP filter. Bridge-side. |
| **MikroTik `arp=reply-only`** | Changes the *router's* ARP behaviour. Doesn't inspect ARPs flying between two associated clients. |
| **UniFi "ARP cache poisoning protection"** | Vendor-named instance of the bridge-side filter family. Same blind spot. |
| **MFP / 802.11w** | Protects management frames (deauth, action). The injected frame is a *data* frame. |
| **Default "client isolation" / "AP isolation"** | Blocks unicast forwarding between clients on the bridge. Does not suppress forged from-DS broadcasts (the AP doesn't know they're forged: `addr2` says it came from the AP itself). |

## Defences that do fire

Each of these sits at the right architectural layer and actually intercepts the malicious frame. (Synthesis of NDSS'26 §VIII and the blog post.)

- **Per-client GTK randomisation** ([Passpoint DGAF Disable extended to FT/FILS/group-key/WNM-Sleep](/wiki/defenses/group-key-randomization/)). The most important one. If every client receives a different GTK, an attacker encrypting under their GTK cannot produce a frame any other client will MIC-verify successfully. The primitive dies at the receiver's CCMP MIC check.
- **Per-BSSID or per-client VLAN.** A different broadcast domain means a different group key context for everything that matters; the attacker and victim don't share a GTK because they're not in the same encryption context. Common in enterprise; rare on home networks.
- **AP Proxy ARP / Hotspot 2.0 DGAF Disable.** AP answers ARP queries from its DHCP-snooping cache and drops from-DS group ARP broadcasts because it has no reason to ever emit one.
- **Endpoint-side ARP hardening.** [`arp_accept=0`](/wiki/defenses/endpoint-arp-hardening/) plus an existing cache entry for the spoofed IP causes the kernel to ignore unsolicited replies that don't match. Per-host hygiene; real, but only blunts the primitive against targets that have talked to the gateway recently.
- **End-to-end [MACsec](/wiki/defenses/macsec/)** between Wi-Fi clients and the gateway. Mitigates impact rather than prevents poisoning: even with a poisoned cache, traffic to the gateway is encrypted at L2, so the attacker-as-MITM sees ciphertext. Right answer for high-value paths; expensive.

## Auto-discovery and the return path

A complete ARP poisoner needs more than the inject primitive. It needs to know the victim's MAC (auto-discovery) and to keep the victim's traffic flowing once it has been redirected (the return path).

**Auto-discovery** goes the other direction across the same architectural boundary. The attacker emits a from-DS ARP request for the victim's IP. The victim's NIC accepts it as a legitimate group broadcast and the victim's IP stack answers. The reply is a normal unicast ARP reply addressed to the attacker. That reply takes the conventional path: victim radio → AP → bridge → AP → attacker NIC. So the bridge sees the *reply* but never the *request*. From the perspective of any router-side ARP-validation rule that watches for unsolicited replies or replies-without-matching-request, the reply looks legitimate, because there *was* a recent request, just not one the bridge ever heard.

**The return path** is a kernel-NAT problem, not a Wi-Fi problem. Once the victim's cache is poisoned, redirected traffic arrives at the attacker. Forwarding it through the attacker's host with `MASQUERADE` keeps the victim's session alive. The only Wi-Fi-specific concern is wanting a static ARP entry for the victim on the attacker side, so the attacker's own ARP cache doesn't get poisoned by the attack the attacker is running.

## Detection difficulty

Detection is hard for an existing SOC. The injected ARP is a CCMP-encrypted broadcast from the AP's MAC, indistinguishable on the wire from any other group broadcast the AP transmits. The unicast ARP reply from the victim looks like an ordinary request/reply pair to any IDS watching the wire — the matching request was over the air under the GTK and never touched a wired link. Wireless IDS *can* in principle spot anomalies in PN sequencing or repeated injections under the same key id, but that instrumentation is rarer than the wire-side IDS most networks deploy.

## Compared to the AirSnitch tests

| | `--c2c-gtk-inject` (AirSnitch) | bridge-side ARP test (AirSnitch) | ARP over GTK (this page) |
| --- | --- | --- | --- |
| Frame direction | from-DS broadcast over the air | to-DS unicast through the bridge | from-DS broadcast over the air |
| Inner payload | ICMP echo | ARP | ARP |
| Path | Radio → victim NIC | Bridge | Radio → victim NIC |
| Bypasses bridge-side ARP defences | n/a (different defence axis) | no — *fails* against DAI | **yes** |
| Demonstrates | OS accepts unicast IP in L2 broadcast | classic ARP poisoner reaches bridge | bridge-side ARP defences are not in path |
| Tool | `airsnitch.py --c2c-gtk-inject` | `airsnitch.py` ARP path | `arpgtk` |

## Implications

The reason to care about the primitive is the size of the deployment universe it actually affects. It applies to any WPA2 or WPA3 network where the AP issues a shared GTK to all clients, which is most of them. The attacker only needs to associate as a normal client. That means anyone with the SSID's credentials: an employee, a contractor, a guest with the Wi-Fi password, an ex-employee whose access was never rotated. No rogue AP, no deauthentication burst, no MFP violation, no control of the AP itself, no 802.1X bypass.

What the primitive enables, once a victim's cache is poisoned, is everything classical [ARP spoofing](/wiki/attacks/arp-spoofing/) could ever do: HTTP injection, downgrade attempts, captive-portal-style hijacking, DNS redirection, credential capture against anything that doesn't pin TLS, session theft on cleartext or weakly-bound sessions.

The strategic implication for a security program is that bridge-side ARP defences are sunk costs against this threat model. They are not wrong; they are simply in the wrong location. Budget that went into them does not need to be re-spent (they still catch ARP attacks from wired hosts and from misconfigured clients), but it cannot be claimed against the ARP-on-Wi-Fi threat model.

## Auditing your own network

Two questions worth answering, both runnable from a single associated client without poisoning anything:

1. **Does the AP issue the same GTK to every associated client?** Associate twice on two virtual managed interfaces and byte-compare the GTKs. Equal → AP shares one group key (exposed). Unequal → per-client GTK randomisation is in effect (mitigated upstream).
2. **Is a specific host actually reachable via from-DS broadcasts?** Send one CCMP-encrypted from-DS broadcast ARP request under the GTK with a benign 169.254.x.x requestor IP and watch the managed iface for the bridged unicast reply. Reply seen → primitive viable. The probe does not poison any cache: a target that records `(benign-link-local, our-mac)` as a side effect doesn't shadow any real host on the network.

[arpgtk](/wiki/tools/arpgtk/) implements both as `--check-gtk-shared` and `--verify --target-ip IP`.

## See also

- [Abusing GTK](/wiki/attacks/abusing-gtk/) — the parent injection envelope.
- [Broadcast Reflection](/wiki/attacks/broadcast-reflection/) — the cousin where the AP itself does the GTK-encryption on the attacker's behalf.
- [ARP](/wiki/concepts/arp/), [ARP spoofing](/wiki/attacks/arp-spoofing/) — the protocol and the parent attack class.
- [Dynamic ARP Inspection](/wiki/defenses/dynamic-arp-inspection/), [Endpoint ARP hardening](/wiki/defenses/endpoint-arp-hardening/), [Group key randomization](/wiki/defenses/group-key-randomization/) — defences.
- [arpgtk](/wiki/tools/arpgtk/) — the auditing tool.
- [Source — Router-side ARP defences blog post](/wiki/sources/blog/2026-05-02-arp-over-gtk/) — provenance.

## References

- Zhou, Pu, Liu, Qian, Tan, Krishnamurthy, Vanhoef. *AirSnitch: Demystifying and Breaking Client Isolation in Wi-Fi Networks.* NDSS 2026.
- *Router-side ARP defenses don't catch what they don't see.* `gengstah.github.io`, 2026-05-02.
- IEEE 802.11-2020 §12 (RSNA) — CCMP framing and group key handling.
- Cisco Catalyst Switch Configuration Guide — Dynamic ARP Inspection.
