---
title: "Reading List"
permalink: /wiki/resources/reading-list/
layout: single
author_profile: true
tags:
  - resources
---

*Books, papers, and posts worth your time. Curated, opinionated, not exhaustive.*

**Status:** seed
**Related:** [Researchers](/wiki/resources/researchers/), [Vulnerability Research](/wiki/domains/vulnerability-research/), [Exploit Development](/wiki/domains/exploit-development/)

{% include toc %}

---

## Foundational books

**Vulnerability research / exploit dev**

- *The Shellcoder's Handbook* (2nd ed.) — Anley, Heasman, Lindner, Richarte. Dated in places; still the foundation.
- *A Bug Hunter's Diary* — Tobias Klein. Real bug hunts narrated end to end.
- *The Art of Software Security Assessment* — Dowd, McDonald, Schuh. The reference for code review.
- *Practical Reverse Engineering* — Dang, Gazet, Bachaalany. x86, ARM, Windows kernel.
- *Practical Binary Analysis* — Dennis Andriesse. Modern; covers DBI, taint, symbolic execution.
- *Windows Internals* (7th ed., Part 1 & 2) — Russinovich, Solomon, Ionescu, Yosifovich, Allievi. Mandatory if you touch Windows kernel.
- *Linux Kernel Development* (3rd ed.) — Robert Love. Older but still the cleanest LKD intro.
- *A Guide to Kernel Exploitation* — Perla, Oldani. Kernel-specific exploit dev.

**Pentest / red team**

- *The Web Application Hacker's Handbook* (2nd ed.) — Stuttard, Pinto. The canonical web-pentest book.
- *The Hacker Playbook 3* — Peter Kim. Practical, scenario-driven.
- *Operator Handbook* — Joshua Picolet. Reference card for everything an operator needs in the moment.
- *Red Team Field Manual* — Ben Clark. Pocket reference.
- *Hacking: The Art of Exploitation* (2nd ed.) — Jon Erickson. Best single intro to memory corruption + networking.

**Cryptography**

- *Cryptography Engineering* — Ferguson, Schneier, Kohno. Practical; what to use and what to avoid.
- *Real-World Cryptography* — David Wong. Modern, accessible.

**Reverse engineering**

- *Reversing: Secrets of Reverse Engineering* — Eldad Eilam. Foundational.
- *The IDA Pro Book* (2nd ed.) — Chris Eagle.
- *The Ghidra Book* — Eagle, Nance.

---

## Papers worth re-reading

- Hutchins, Cloppert, Amin — *Intelligence-Driven Computer Network Defense* (2011). The Kill Chain paper.
- *Smashing the Stack for Fun and Profit* — Aleph One, Phrack 49 (1996). Historical; still the cleanest exposition of stack overflows.
- *Heap Feng Shui in JavaScript* — Alexander Sotirov (2007). Origin of heap-grooming in browser exploitation.
- *On the Effectiveness of Address-Space Randomization* — Shacham et al. (2004). Why ASLR is hard to do well.
- *Q: Exploit Hardening Made Easy* — Schwartz, Avgerinos, Brumley. Automated ROP.
- *AEG: Automatic Exploit Generation* — Avgerinos, Cha, Hao, Brumley.
- *Certified Pre-Owned* — Schroeder, Christensen (SpecterOps). The reference for ADCS attacks.
- Karpathy — *llm-wiki.md* (2025). The pattern this wiki implements.

---

## Blogs to follow

- **Project Zero** (Google) — <https://googleprojectzero.blogspot.com/>
- **MSRC blog** — <https://msrc.microsoft.com/blog/>
- **Zero Day Initiative** — <https://www.zerodayinitiative.com/blog>
- **SpecterOps** — <https://posts.specterops.io/>
- **TrustedSec** — <https://www.trustedsec.com/blog/>
- **Outflank** — <https://www.outflank.nl/blog/>
- **MDSec** — <https://www.mdsec.co.uk/blog/>
- **NCC Group Research** — <https://research.nccgroup.com/>
- **Synacktiv** — <https://www.synacktiv.com/publications>
- **StarLabs** — <https://starlabs.sg/blog/>
- **HN Security** — <https://security.humanativaspa.it/>
- **k0shl** — <https://whereisk0shl.top/>
- **Connor McGarr** — <https://connormcgarr.github.io/>
- **Saar Amar** — <https://saaramar.github.io/>

---

## Standards and references

- **MITRE ATT&CK** — <https://attack.mitre.org/>
- **CWE** — <https://cwe.mitre.org/>
- **CVSS calculator** — <https://www.first.org/cvss/calculator/3.1>
- **NVD** — <https://nvd.nist.gov/>
- **HackTricks** — <https://book.hacktricks.xyz/> (the working operator's reference)
- **PayloadsAllTheThings** — <https://github.com/swisskyrepo/PayloadsAllTheThings>
- **gtfobins** — <https://gtfobins.github.io/>
- **lolbas** — <https://lolbas-project.github.io/>

---

## Training / hands-on

- **HackTheBox** / **TryHackMe** / **VulnHub** — interactive boxes.
- **PortSwigger Web Security Academy** — best free web-pentest training.
- **pwn.college** — open-source binary-exploitation curriculum.
- **exploit.education** (Phoenix, Nebula, Protostar) — classic VMs.
- **Pwn2Own / DEFCON CTF / GoogleCTF** writeups — current top-of-field tradecraft, free.
- **OffSec courses** — OSCP / OSEP / OSED / OSEE for credentialing; OSEE is the high-end.
