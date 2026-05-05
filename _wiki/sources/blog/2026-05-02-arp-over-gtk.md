---
title: Source — Router-side ARP defenses don't catch what they don't see
permalink: /wiki/sources/blog/2026-05-02-arp-over-gtk/
layout: single
author_profile: true
tags:
- arp
- airsnitch
- wifi
- source
- blog
sources: []
updated: 2026-05-02
---

**Post:** [`/posts/2026/05/arp-over-gtk/`](/posts/2026/05/arp-over-gtk/) — `_posts/2026-05-02-blog.md`.
**Author:** gengstah.
**Status:** `integrated`.

## Summary

Original blog post that combines two existing AirSnitch primitives — GTK extraction (`--check-gtk-shared`) and from-DS GTK-encrypted broadcast injection (`--c2c-gtk-inject`) — into a single primitive: an ARP frame inside a GTK-encrypted broadcast Wi-Fi frame, sent radio-to-radio between two associated stations.

The structural observation: this primitive bypasses the entire family of router-side ARP defences (Cisco DAI, DHCP-snooping ARP filtering, IP-MAC binding, `ebtables`/`arptables`, MikroTik `arp=reply-only`, UniFi "ARP cache poisoning protection") because the malicious frame never crosses the AP's bridge. Bridge-side hooks cannot fire on a frame that isn't on the bridge.

The cryptographic content is unchanged from AirSnitch: same `encrypt_ccmp` from Vanhoef's `libwifi`, same frame format, same patched `wpa_supplicant` for GTK extraction. The contribution is the architectural framing — taking the existing GTK-broadcast envelope, swapping the inner ICMP for ARP, and applying the result to a different defence category ("is this ARP frame valid?" as enforced on the router or AP bridge) than AirSnitch originally aimed at ("are these two clients allowed to talk?").

## Key takeaways

- Router-side ARP defences are architecturally a no-op against ARP-over-GTK on Wi-Fi. They are not wrong, just in the wrong location.
- The actual mitigations are AP-side or endpoint-side: per-client GTK randomisation, per-BSSID VLAN, AP Proxy ARP / DGAF Disable, endpoint ARP hardening (`arp_accept=0` plus populated cache), MACsec.
- Auto-discovery and the return path work too. The attacker's `who-has` request goes over the air under the GTK; the victim's reply takes the conventional bridge path, so any IDS watching the wire sees a normal request/reply pair.
- Detection is hard. The injected ARP is a CCMP-encrypted broadcast from the AP's MAC, indistinguishable on the wire from any other AP broadcast. Wireless IDS can in principle spot PN-sequencing anomalies, but that instrumentation is rare.
- The auditing tool `arpgtk` (the user's own) implements both checks (`--check-gtk-shared` and `--verify --target-ip`) without poisoning anything.

## Wiki pages this post informed

- [ARP over GTK](/wiki/attacks/arp-over-gtk/) — the central technique.
- [ARP](/wiki/concepts/arp/) — the protocol primer.
- [ARP spoofing](/wiki/attacks/arp-spoofing/) — the broader attack class the primitive belongs to.
- [Dynamic ARP Inspection](/wiki/defenses/dynamic-arp-inspection/) — the defence family the primitive bypasses.
- [Endpoint ARP hardening](/wiki/defenses/endpoint-arp-hardening/) — the per-host complement.
- [arpgtk](/wiki/tools/arpgtk/) — the auditing tool.

## Excerpt

> *For a long time the standard answer to ARP poisoning on the LAN has been "use Dynamic ARP Inspection." Cisco DAI checks every ARP frame against the DHCP-snooping binding table; offending frames get dropped at the switchport. On more capable APs and home routers there are equivalents… Every one of them works the same way at heart: catch the malicious ARP as it crosses the bridge.*
>
> *On Wi-Fi, the malicious ARP doesn't cross the bridge.*
