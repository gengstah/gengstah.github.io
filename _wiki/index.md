---
title: "Offensive Security Wiki"
permalink: /wiki/
layout: single
author_profile: true
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
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
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
.wiki-card .meta {
  font-size: .8em;
  opacity: .7;
  margin-bottom: .5em;
}
.wiki-card p { margin: 0; font-size: .92em; }
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
      <div class="meta">Scoped, time-boxed assessments</div>
      <p>Methodology, engagement types, reporting. Find and demonstrate exploitable weaknesses against a defined target.</p>
    </div>
    <div class="wiki-card">
      <h3><a href="/wiki/domains/red-teaming/">Red Teaming</a></h3>
      <div class="meta">Adversary emulation, full kill-chain</div>
      <p>Stealth-first operations that test detection and response, not vulnerability coverage. OPSEC is the discipline.</p>
    </div>
    <div class="wiki-card">
      <h3><a href="/wiki/domains/vulnerability-research/">Vulnerability Research</a></h3>
      <div class="meta">Code review, fuzzing, patch diffing</div>
      <p>Find unknown bugs in software, hardware, and protocols. Characterize them well enough to fix or weaponize.</p>
    </div>
    <div class="wiki-card">
      <h3><a href="/wiki/domains/exploit-development/">Exploit Development</a></h3>
      <div class="meta">Bug → primitive → reliable exploit</div>
      <p>Engineering discipline that turns a known bug into a working primitive, defeats mitigations, and ships reliably.</p>
    </div>
  </div>
</div>

<div class="wiki-section" markdown="0">
  <h2>Topic deep-dives</h2>
  <p>Per-topic micro-wikis, ingested from raw sources and structured for browsing.</p>
  <div class="wiki-grid">
    <div class="wiki-card">
      <h3><a href="/wiki/airsnitch/">AirSnitch</a></h3>
      <div class="meta">34 pages + <a href="/wiki/airsnitch/sources/">3 sources</a> · NDSS 2026 · Wi-Fi client-isolation bypass</div>
      <p>The Vanhoef-et-al. paper and tooling — eight Wi-Fi attacks that defeat client isolation across WPA2/WPA3, plus defenses, devices, and CLI reference.</p>
    </div>
    <div class="wiki-card">
      <h3><a href="/wiki/windows-exploit-research/">Windows Exploit Research</a></h3>
      <div class="meta">64 pages + <a href="/wiki/windows-exploit-research/sources/">60 sources</a> · CVE deep-dives, kernel internals, mitigations</div>
      <p>CLFS, cldflt, CimFS, IORING, WNF, kernel streaming, TCP/IP stack. 28 CVE write-ups paired with the kernel internals, techniques, and tools they exercise.</p>
    </div>
    <div class="wiki-card">
      <h3><a href="/wiki/offsec-notes/">Offensive Security Notes</a></h3>
      <div class="meta">64 pages + <a href="/wiki/offsec-notes/sources/">83 sources</a> · concepts, tools, playbooks</div>
      <p>Field-notebook style coverage: ~45 concept pages (kerberoasting → JIT shellcode), 11 tool entries, and 4 engagement playbooks.</p>
    </div>
  </div>
</div>

<div class="wiki-section" markdown="0">
  <h2>Foundations</h2>
  <div class="wiki-grid">
    <div class="wiki-card">
      <h3><a href="/wiki/concepts/cyber-kill-chain/">Cyber Kill Chain</a></h3>
      <p>Lockheed Martin's seven-stage model of how a targeted intrusion unfolds.</p>
    </div>
    <div class="wiki-card">
      <h3><a href="/wiki/concepts/mitre-attack/">MITRE ATT&amp;CK</a></h3>
      <p>The empirical matrix of tactics × techniques observed in real intrusions.</p>
    </div>
    <div class="wiki-card">
      <h3><a href="/wiki/concepts/opsec/">OPSEC</a></h3>
      <p>Operational security — keeping the operator's signature below the defender's noise floor.</p>
    </div>
  </div>
</div>

<div class="wiki-section" markdown="0">
  <h2>Techniques</h2>
  <div class="wiki-grid">
    <div class="wiki-card">
      <h3><a href="/wiki/techniques/recon/">Reconnaissance</a></h3>
      <p>Mapping the target before touching it — passive and active enumeration.</p>
    </div>
    <div class="wiki-card">
      <h3><a href="/wiki/techniques/initial-access/">Initial Access</a></h3>
      <p>Phishing, exposed services, supply chain — getting the first foothold inside.</p>
    </div>
    <div class="wiki-card">
      <h3><a href="/wiki/techniques/privilege-escalation/">Privilege Escalation</a></h3>
      <p>Local user → admin / SYSTEM / root, on Windows, Linux, AD, and cloud.</p>
    </div>
    <div class="wiki-card">
      <h3><a href="/wiki/techniques/lateral-movement/">Lateral Movement</a></h3>
      <p>Pivoting, credential reuse — RDP / SMB / WMI / WinRM and their OPSEC profiles.</p>
    </div>
    <div class="wiki-card">
      <h3><a href="/wiki/techniques/persistence/">Persistence</a></h3>
      <p>Surviving reboots, user logouts, and AV sweeps without lighting up the SIEM.</p>
    </div>
  </div>
</div>

<div class="wiki-section" markdown="0">
  <h2>Tools</h2>
  <div class="wiki-grid">
    <div class="wiki-card">
      <h3><a href="/wiki/tools/nmap/">nmap</a></h3>
      <p>Network discovery and port scanning. The scriptable standard.</p>
    </div>
    <div class="wiki-card">
      <h3><a href="/wiki/tools/burpsuite/">Burp Suite</a></h3>
      <p>The dominant web-app testing proxy.</p>
    </div>
    <div class="wiki-card">
      <h3><a href="/wiki/tools/ghidra/">Ghidra</a></h3>
      <p>NSA reverse-engineering suite. Free Hex-Rays competitor.</p>
    </div>
    <div class="wiki-card">
      <h3><a href="/wiki/tools/cobalt-strike/">Cobalt Strike</a></h3>
      <p>The dominant commercial adversary-emulation / C2 platform.</p>
    </div>
  </div>
</div>

<div class="wiki-section" markdown="0">
  <h2>Resources</h2>
  <div class="wiki-grid">
    <div class="wiki-card">
      <h3><a href="/wiki/resources/reading-list/">Reading List</a></h3>
      <p>Books, papers, and posts worth your time. Curated, opinionated.</p>
    </div>
    <div class="wiki-card">
      <h3><a href="/wiki/resources/researchers/">Researchers</a></h3>
      <p>People doing notable work in offensive security, by area.</p>
    </div>
  </div>
</div>

<div class="wiki-section" markdown="0">
  <h2>How this wiki works</h2>
  <p>An LLM agent maintains the wiki: ingests sources, writes pages, updates cross-references, appends to the log. The human curates sources and asks questions. See the <a href="/wiki/schema/">schema</a> for conventions, and the <a href="/wiki/log/">log</a> for a chronological record of every change.</p>
</div>
