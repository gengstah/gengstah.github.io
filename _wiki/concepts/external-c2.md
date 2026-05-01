---
title: "External C2 (Cobalt Strike External C2 Spec)"
permalink: /wiki/concepts/external-c2/
layout: single
author_profile: true
tags:
  - c2
  - cobalt-strike
  - external-c2
  - outflank
---

*The Cobalt Strike External C2 specification — a minimal protocol that lets a third-party transport carry Beacon traffic. The spec was Mark Bergman / Outflank's 2017 demonstration vehicle; it remains the canonical way to tunnel C2 over channels that don't speak HTTP/DNS natively (Outlook MAPI, Slack, Tor hidden services, mobile tethers, cloud KV stores).*

**Status:** drafting
**Related:** [Command and Control](/wiki/concepts/command-and-control/), [Outflank blog catalogue](/wiki/resources/outflank/), [BOFs](/wiki/concepts/beacon-object-files/)

---

## What External C2 is

Cobalt Strike's Beacon talks to its team server via HTTP, HTTPS, DNS, or SMB by default. **External C2** lets you replace the transport entirely. Your own program — the *External C2 client* — pulls Beacon's outgoing data over Cobalt Strike's local control channel, ferries it to the team server through whatever transport you've built, and pushes responses back.

The spec is small:

- **Tasks-out endpoint** on the team server (or via an Aggressor `external_c2_start` spec) listens on a TCP port.
- The External C2 Client connects to that port.
- The team server hands the client an opaque **Beacon stage**.
- The client delivers the stage to the implant somehow (e.g. drops it via the chosen transport).
- After detonation, the implant pulls tasks via the chosen transport, hands them back to the client, which pushes to the team server.

The implant itself runs **SMB Beacon** locally (one process is a Beacon "server" listening on a named pipe; the External C2 program is the bridge). Beacon doesn't know or care what the transport is.

## Outflank's 2017 demonstration

Mark Bergman's *Cobalt Strike over external C2 – beacon home in the most obscure ways* showed an Outlook MAPI transport. The premise: a corporate user is allowed to send/receive Outlook email. An Outflank-built External C2 client used the local Outlook profile to pass Beacon tasks as the body of carefully-crafted draft emails, never actually sent — pulled from the victim's Outlook to a remote attacker's Outlook through the Exchange server.

The flow:

```
Implant (SMB Beacon) ↔ External C2 Client (in-process Outlook MAPI) ↔ Exchange ↔ Operator's mailbox ↔ Operator's External C2 client ↔ Team Server
```

Key wins:

- All traffic is corporate Exchange. Network egress is normal-shaped HTTPS to Outlook web / Exchange. Proxy / IDS sees nothing unusual.
- DLP / sandbox doesn't typically inspect drafts that aren't sent.
- Defender for O365 might flag the *content* of mails (if it scans drafts), but encrypted Beacon traffic looks like opaque blobs.

## Variants since 2017

Operators have built External C2 transports over a long list of carriers:

| Transport | Notes |
|---|---|
| Outlook MAPI / EWS | The Outflank classic. Still effective on tightly-egress'd networks. |
| Microsoft Teams / Slack DMs | Bot-channel traffic blends with corp chat. |
| GitHub gists / GitLab snippets | Free file-store with permissioning. |
| Tor hidden services | Anonymity, but flagged by some IDS as Tor-shaped traffic. |
| Onedrive / Dropbox API | Cloud-storage-based dead-drop. |
| Google Calendar event descriptions | Yes, this works. Polled. |
| Bluetooth tether between two compromised hosts | Off-network. |
| QR-code → camera (air-gap) | Demo-grade but real. |

Beacon's *External C2 SMB-pipe* design means the implant is unaware of all this. From its perspective it's just talking to a local SMB pipe.

## Recent additions

[Outflank C2](/wiki/tools/outflank-c2/) (released 2024-08-07) is Outflank's own multi-platform C2 framework. Different from External C2 — it's a complete C2, not a Cobalt-Strike-Beacon-tunnel. But the design lessons (transport agility, implant simplicity, decoupled team-server / staging) carry forward.

## Detection

- Outbound from non-Outlook-process to Exchange APIs. (Outflank's MAPI bridge is *inside* Outlook; harder to spot than an external HTTP client hitting EWS.)
- Long-lived named-pipe SMB connections (Beacon's local bridge) where neither side is a domain process.
- Unusual mail behaviour: drafts being created and immediately deleted, or never sent, by the same user account on a cycle.
- Beacon's classic post-staging behaviour (process injection, AMSI patching, named-pipe spawn) still applies regardless of transport.

## See also

- [Command and Control](/wiki/concepts/command-and-control/) — the umbrella.
- [Beacon Object Files](/wiki/concepts/beacon-object-files/) — what gets executed inside Beacon.
- [Outflank C2](/wiki/tools/outflank-c2/) — Outflank's standalone framework.

## References

- Outflank — Mark Bergman — *Cobalt Strike over external C2* (2017-09-17) — <https://www.outflank.nl/blog/2017/09/17/blogpost-cobalt-strike-over-external-c2-beacon-home-in-the-most-obscure-ways/>
- Outflank — *Building resilient C2 infrastructures using DNS over HTTPS* (2018-10-25) — <https://www.outflank.nl/blog/2018/10/25/building-resilient-c2-infrastructues-using-dns-over-https/>
- Cobalt Strike — *External C2 specification* (Help Systems / Fortra docs).
