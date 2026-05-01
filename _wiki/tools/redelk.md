---
title: "RedELK"
permalink: /wiki/tools/redelk/
layout: single
author_profile: true
tags:
  - tool
  - redelk
  - red-team
  - logging
  - outflank
---

*Open-source SIEM-for-red-teams. Aggregates logs from C2 servers and redirectors into an ELK stack so an operator can monitor an engagement, detect blue-team probes ("are we burned yet?"), and produce trail evidence after-the-fact. Marc Smeets / Outflank, 2019.*

**Status:** drafting
**Related:** [Command and Control](/wiki/concepts/command-and-control/), [Red Teaming](/wiki/concepts/red-teaming/), [OPSEC](/wiki/concepts/opsec/), [Outflank blog catalogue](/wiki/resources/outflank/)

---

## What it does

A red-team engagement typically runs across:

- One or more team servers (Cobalt Strike, Mythic, Brute Ratel, Outflank C2, …).
- Several redirectors (Apache / Nginx / HAProxy with vendor-shaped traffic-shaping).
- Sometimes a domain-front, sometimes a CDN, sometimes a malleable transport.

Each component has its own logs. RedELK ships those into a centralised ELK stack with red-team-specific dashboards:

- Beacon callbacks per implant, per IP, per UA, per cookie.
- Lateral-movement timeline.
- Blue-team probe detection — incoming requests that look like analyst / sandbox / scanner activity hitting your redirector.
- Geographic / ASN distribution of incoming connections (the AWS / Azure scanner clouds versus the actual victim).
- IOC / domain / cert correlation across infra.

## Architecture

```
Cobalt Strike team server  ────┐
Mythic team server         ────┤
Apache redirector          ────┼──►  Filebeat   ──►  Logstash  ──►  Elasticsearch
HAProxy redirector         ────┤                                       │
Custom infra               ────┘                                       ▼
                                                                 Kibana dashboards
```

Filebeat shippers run on each component, tagged with the component's role. Logstash pipelines parse vendor-specific log formats into a normalised schema (JSON with `redelk.role`, `redelk.engagement`, `beacon_id`, `target_ip`, `analyst`, etc.). Kibana dashboards produced by RedELK ship with the install.

## Detecting blue-team interest

The most distinctive feature. RedELK includes a **detection rules engine** with rules tuned to blue-team / sandbox traffic:

- IP/domain hits the redirector with no preceding beacon stage download → likely sandbox replay.
- UA strings characteristic of analyst tools, sandboxes, scanners (`urlscan.io`, `Hybrid-Analysis`, `Joe Sandbox`, `Anyrun`, `vt`, `palo`).
- ASN correlation — incoming probes from defender ASNs (Microsoft, Google, AWS investigation IPs).
- DNS pivot graph — the hostname your redirector serves, who's looked it up, from where.

If the engagement is "going hot" — defender has fingerprinted the C2 — RedELK flags it on a dashboard. The operator can swap infrastructure before the implant is killed.

## Three-part Outflank introduction

- **Part 1** (Marc Smeets, 2019-02-14) — *Why we need it.* Motivation: red teams operate across more infra than they can humanly monitor; blue teams' first action on detection is usually to query infra and trigger detectable artefacts; without monitoring you won't notice until your beacons go dark.
- **Part 2** (2020-02-28) — *Getting you up and running.* Hands-on installer. Single-host PoC vs production deployment. Filebeat config per role.
- **Part 3** (2020-04-07) — *Achieving operational oversight.* The detection engine. Custom alerts. Day-2 operations.

## Modern variants and adoption

RedELK is open-source (<https://github.com/outflanknl/RedELK>) and active. Variants and forks:

- Some teams pair RedELK with Splunk / Datadog instead of ELK.
- Mythic ships its own logging that overlaps; teams running Mythic + Cobalt Strike often use RedELK as the unifier.
- Outflank's commercial **OST (Outflank Security Tooling)** integrates RedELK as a default component. See [OST](/wiki/tools/ost/).

## See also

- [Command and Control](/wiki/concepts/command-and-control/) — what RedELK monitors.
- [Outflank C2](/wiki/tools/outflank-c2/), [OST](/wiki/tools/ost/).
- [OPSEC](/wiki/concepts/opsec/) — RedELK is an OPSEC instrument.

## References

- RedELK on GitHub — <https://github.com/outflanknl/RedELK>
- Outflank — Marc Smeets — *Introducing RedELK – Part 1: why we need it* (2019-02-14).
- Outflank — *RedELK Part 2 – getting you up and running* (2020-02-28).
- Outflank — *RedELK Part 3 – Achieving operational oversight* (2020-04-07).
