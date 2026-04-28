---
title: "Offensive Security Wiki"
permalink: /wiki/
layout: single
author_profile: true
redirect_from:
  - /wiki/offsec-notes/
---

<style>
.wiki-hero {
  border: 1px solid rgba(127,127,127,.25);
  border-radius: 8px;
  padding: 1.4em 1.6em;
  margin: 0 0 1.5em 0;
  background: rgba(127,127,127,.04);
}
.wiki-hero h2 { margin-top: 0; }
.wiki-hero .cta {
  display: inline-block;
  margin-top: .6em;
  padding: .55em 1.1em;
  border-radius: 6px;
  background: #2c5282;
  color: #fff !important;
  font-weight: 600;
  text-decoration: none;
}
.wiki-hero .cta:hover { background: #1a365d; }
.wiki-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1em;
  margin: 1em 0 1.5em 0;
}
.wiki-card {
  border: 1px solid rgba(127,127,127,.25);
  border-radius: 8px;
  padding: 1em 1.1em;
  background: rgba(127,127,127,.03);
}
.wiki-card h3 { margin-top: 0; margin-bottom: .35em; font-size: 1.05em; }
.wiki-card h3 a { text-decoration: none; }
.wiki-card .count {
  font-size: .8em; opacity: .7; margin-bottom: .5em;
}
.wiki-card .examples {
  font-size: .9em; margin: 0;
}
.wiki-card .examples a { white-space: nowrap; }
.wiki-section { margin-top: 2em; }
.wiki-section h2 { border-bottom: 1px solid rgba(127,127,127,.25); padding-bottom: .3em; }
</style>

<div class="wiki-hero" markdown="0">
  <h2>An LLM-maintained wiki for offensive security.</h2>
  <p>Penetration testing, red teaming, vulnerability research, exploit development. Curated raw sources, structured notes that compound. Built on <a href="https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f">Karpathy's LLM Wiki pattern</a>.</p>
  <p><a class="cta" href="/wiki/overview/">Start with the overview →</a></p>
</div>

<div class="wiki-section" markdown="0">
  <h2>The four pillars</h2>
  <div class="wiki-grid">
    <div class="wiki-card">
      <h3><a href="/wiki/domains/penetration-testing/">Penetration Testing</a></h3>
      <p class="examples">Scoped, time-boxed assessments. Methodology, engagement types, reporting.</p>
    </div>
    <div class="wiki-card">
      <h3><a href="/wiki/domains/red-teaming/">Red Teaming</a></h3>
      <p class="examples">Adversary emulation, full kill-chain. Stealth-first, OPSEC discipline.</p>
    </div>
    <div class="wiki-card">
      <h3><a href="/wiki/domains/vulnerability-research/">Vulnerability Research</a></h3>
      <p class="examples">Code review, fuzzing, patch diffing — finding bugs nobody else has reported.</p>
    </div>
    <div class="wiki-card">
      <h3><a href="/wiki/domains/exploit-development/">Exploit Development</a></h3>
      <p class="examples">Bug → primitive → reliable exploit. Mitigation-aware, version-portable.</p>
    </div>
  </div>
</div>

<div class="wiki-section" markdown="0">
  <h2>Browse by category</h2>
  <div class="wiki-grid">

    <div class="wiki-card">
      <h3><a href="/wiki/concepts/">Concepts</a></h3>
      <div class="count">60 pages</div>
      <p class="examples">
        <a href="/wiki/concepts/cyber-kill-chain/">cyber kill chain</a> ·
        <a href="/wiki/concepts/mitre-attack/">MITRE ATT&amp;CK</a> ·
        <a href="/wiki/concepts/opsec/">OPSEC</a> ·
        <a href="/wiki/concepts/kerberoasting/">kerberoasting</a> ·
        <a href="/wiki/concepts/active-directory-attacks/">AD attacks</a> ·
        <a href="/wiki/concepts/lsass-dumping/">LSASS dumping</a> ·
        <a href="/wiki/concepts/wifi-key-hierarchy/">Wi-Fi key hierarchy</a> ·
        <a href="/wiki/concepts/dll-hijacking/">DLL hijacking</a>
      </p>
    </div>

    <div class="wiki-card">
      <h3><a href="/wiki/techniques/">Techniques</a></h3>
      <div class="count">11 pages — TTPs across operations and exploitation</div>
      <p class="examples">
        <a href="/wiki/techniques/recon/">recon</a> ·
        <a href="/wiki/techniques/initial-access/">initial access</a> ·
        <a href="/wiki/techniques/privilege-escalation/">priv-esc</a> ·
        <a href="/wiki/techniques/lateral-movement/">lateral movement</a> ·
        <a href="/wiki/techniques/persistence/">persistence</a> ·
        <a href="/wiki/techniques/rop/">ROP</a> ·
        <a href="/wiki/techniques/use_after_free/">UAF</a> ·
        <a href="/wiki/techniques/heap_grooming/">heap grooming</a>
      </p>
    </div>

    <div class="wiki-card">
      <h3><a href="/wiki/tools/">Tools</a></h3>
      <div class="count">23 pages — frameworks, debuggers, scanners, C2</div>
      <p class="examples">
        <a href="/wiki/tools/nmap/">nmap</a> ·
        <a href="/wiki/tools/burpsuite/">Burp</a> ·
        <a href="/wiki/tools/ghidra/">Ghidra</a> ·
        <a href="/wiki/tools/cobalt-strike/">Cobalt Strike</a> ·
        <a href="/wiki/tools/bloodhound/">BloodHound</a> ·
        <a href="/wiki/tools/mimikatz/">mimikatz</a> ·
        <a href="/wiki/tools/impacket/">impacket</a> ·
        <a href="/wiki/tools/debugging/">WinDbg</a> ·
        <a href="/wiki/tools/fuzzing/">fuzzing</a>
      </p>
    </div>

    <div class="wiki-card">
      <h3><a href="/wiki/cves/">CVEs</a></h3>
      <div class="count">29 deep-dive write-ups</div>
      <p class="examples">
        <a href="/wiki/cves/CVE-2025-29824/">CVE-2025-29824</a> (CLFS UAF) ·
        <a href="/wiki/cves/CVE-2024-38063/">CVE-2024-38063</a> (TCP/IP) ·
        <a href="/wiki/cves/CVE-2024-30085/">CVE-2024-30085</a> (cldflt) ·
        <a href="/wiki/cves/CVE-2020-1350/">SIGRed</a> ·
        <a href="/wiki/cves/CVE-2024-26170/">CimFS</a>
      </p>
    </div>

    <div class="wiki-card">
      <h3><a href="/wiki/kernel/">Kernel internals</a></h3>
      <div class="count">15 pages — Windows kernel attack surface</div>
      <p class="examples">
        <a href="/wiki/kernel/architecture/">architecture</a> ·
        <a href="/wiki/kernel/clfs/">CLFS</a> ·
        <a href="/wiki/kernel/cldflt/">cldflt</a> ·
        <a href="/wiki/kernel/ioring/">IORING</a> ·
        <a href="/wiki/kernel/wnf_internals/">WNF</a> ·
        <a href="/wiki/kernel/kernel_streaming/">kernel streaming</a> ·
        <a href="/wiki/kernel/mitigations/">mitigations</a>
      </p>
    </div>

    <div class="wiki-card">
      <h3><a href="/wiki/usermode/">User-mode exploitation</a></h3>
      <div class="count">4 pages — heap, stack, browser, mitigations</div>
      <p class="examples">
        <a href="/wiki/usermode/heap_internals/">heap internals</a> ·
        <a href="/wiki/usermode/stack_exploitation/">stack</a> ·
        <a href="/wiki/usermode/browser_exploitation/">browser</a> ·
        <a href="/wiki/usermode/mitigations/">mitigations</a>
      </p>
    </div>

    <div class="wiki-card">
      <h3><a href="/wiki/attacks/">Attacks (Wi-Fi)</a></h3>
      <div class="count">8 pages — AirSnitch / NDSS 2026</div>
      <p class="examples">
        <a href="/wiki/attacks/abusing-gtk/">abusing GTK</a> ·
        <a href="/wiki/attacks/port-stealing/">port stealing</a> ·
        <a href="/wiki/attacks/gateway-bouncing/">gateway bouncing</a> ·
        <a href="/wiki/attacks/broadcast-reflection/">broadcast reflection</a> ·
        <a href="/wiki/attacks/rogue-ap/">rogue AP</a>
      </p>
    </div>

    <div class="wiki-card">
      <h3><a href="/wiki/defenses/">Defenses (Wi-Fi)</a></h3>
      <div class="count">8 pages — controls vs. AirSnitch</div>
      <p class="examples">
        <a href="/wiki/defenses/group-key-randomization/">group-key randomization</a> ·
        <a href="/wiki/defenses/macsec/">MACsec</a> ·
        <a href="/wiki/defenses/vlans/">VLANs</a> ·
        <a href="/wiki/defenses/spoofing-prevention/">spoofing prevention</a>
      </p>
    </div>

    <div class="wiki-card">
      <h3><a href="/wiki/playbooks/">Playbooks</a></h3>
      <div class="count">4 pages — engagement runbooks</div>
      <p class="examples">
        <a href="/wiki/playbooks/active-directory-pentest/">AD pentest</a> ·
        <a href="/wiki/playbooks/external-pentest/">external</a> ·
        <a href="/wiki/playbooks/internal-network-pentest/">internal network</a> ·
        <a href="/wiki/playbooks/web-app-pentest/">web app</a>
      </p>
    </div>

    <div class="wiki-card">
      <h3><a href="/wiki/devices/tested-devices/">Devices</a></h3>
      <div class="count">1 page — Wi-Fi vendor test results</div>
      <p class="examples">Routers and APs tested in the AirSnitch suite (Tables I–III digest).</p>
    </div>

    <div class="wiki-card">
      <h3><a href="/wiki/resources/">Resources</a></h3>
      <div class="count">5 pages — reading lists, researchers, templates</div>
      <p class="examples">
        <a href="/wiki/resources/reading-list/">reading list</a> ·
        <a href="/wiki/resources/researchers/">researchers</a> ·
        <a href="/wiki/resources/papers_and_blogs/">papers &amp; blogs</a> ·
        <a href="/wiki/resources/cve_template/">CVE template</a>
      </p>
    </div>

    <div class="wiki-card">
      <h3><a href="/wiki/sources/">Sources</a></h3>
      <div class="count">146 provenance pages — raw material that fed the wiki</div>
      <p class="examples">
        <a href="/wiki/sources/airsnitch/">airsnitch</a> ·
        <a href="/wiki/sources/windows-exploit-research/">windows-exploit-research</a> ·
        <a href="/wiki/sources/offsec/">offsec</a>
      </p>
    </div>

  </div>
</div>

<div class="wiki-section" markdown="0">
  <h2>How this wiki works</h2>
  <p>An LLM agent maintains the wiki: ingests sources, writes pages, updates cross-references, appends to the log. The human curates sources and asks questions. See the <a href="/wiki/schema/">schema</a> for conventions, and the <a href="/wiki/log/">log</a> for a chronological record of every change.</p>
</div>
