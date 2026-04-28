---
title: Buffer Overflow / Memory Corruption
permalink: /wiki/offsec-notes/concepts/buffer-overflow/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
---

**Category:** Exploit Development / Binary Exploitation
**MITRE ATT&CK:** T1203 (Exploitation for Client Execution), T1068 (Exploitation for Privilege Escalation)
**Related:** [Privilege Escalation Linux](/wiki/offsec-notes/concepts/privilege-escalation-linux/), [Privilege Escalation Windows](/wiki/offsec-notes/concepts/privilege-escalation-windows/), [Evasion Techniques](/wiki/offsec-notes/concepts/evasion-techniques/)

## Overview
Buffer overflow vulnerabilities occur when a program writes more data to a buffer than it can hold, corrupting adjacent memory. Classic stack-based overflows overwrite the return address to redirect execution. Heap overflows, use-after-free, and format string bugs are related classes. Modern exploitation requires bypassing mitigations: ASLR, NX/DEP, Stack Canaries, PIE, RELRO.

## How It Works

### Classic Stack Buffer Overflow
1. Find a function with a fixed-size buffer read via unsafe function (`gets`, `strcpy`, `sprintf`).
2. Input more bytes than the buffer holds → overflow into saved EBP → overwrite return address (RIP/EIP).
3. Control RIP → redirect execution to shellcode or ROP chain.

### Mitigations & Bypass Techniques

| Mitigation | What it does | Bypass |
|------------|-------------|--------|
| Stack Canary | Random value before return addr; checked on return | Info leak to read canary; bruteforce (32-bit) |
| NX/DEP | Non-executable stack/heap | ROP (Return-Oriented Programming) |
| ASLR | Randomize base addresses | Info leak for base address; partial overwrite; bruteforce |
| PIE | Randomize executable base | Info leak for text base |
| RELRO (Full) | Make GOT read-only | Partial RELRO: overwrite GOT; Full: harder |

### Return-Oriented Programming (ROP)
Chain small instruction sequences ending in `ret` (gadgets) from loaded modules to build arbitrary computation without injecting new code. Used to call `mprotect` (make stack executable) or `execve("/bin/sh")`.

```python
# pwntools ROP example
from pwn import *
elf = ELF('./vuln')
rop = ROP(elf)
rop.execve(b'/bin/sh\x00', 0, 0)
```

### Heap Exploitation (Overview)
- **Use-after-free (UAF):** Dereference freed memory that's been reallocated with attacker-controlled data.
- **Heap overflow:** Corrupt heap metadata or adjacent object.
- **Double free:** Free same chunk twice → corrupt allocator state.
- Exploit techniques: tcache poisoning, fastbin attack, unsorted bin attack (glibc), House of Spirit, etc.

### Format String Vulnerabilities
- `printf(user_input)` — user controls format string.
- `%x` to leak stack values (find canary, addresses).
- `%n` to write arbitrary values to arbitrary addresses.

## Exploit Development Methodology
```
1. Identify vulnerability (fuzzing, source review, binary analysis)
2. Control RIP/EIP: find offset with cyclic pattern
   python3 -c "import pwn; pwn.cyclic(200)" | ./vuln
   pwn cyclic -l <value at crash>
3. Check mitigations: checksec ./vuln
4. Find gadgets: ROPgadget --binary vuln, ropper
5. Leak addresses if needed (for ASLR bypass)
6. Build exploit: pwntools script
7. Test locally, adapt for remote (offset differences, libc version)
```

```bash
# Common gdb workflow
gdb -q ./vuln
(gdb) run < <(python3 -c "print('A'*100 + 'B'*8)")
(gdb) info registers
(gdb) x/20wx $rsp

# pwndbg / peda / gef enhance gdb for exploit dev
```

## Tools
- `pwntools` — Python library for exploit development (remote, ELF, ROP, packing)
- `gdb` + `pwndbg` / `gef` / `peda` — enhanced debuggers
- `ROPgadget` / `ropper` — ROP gadget finder
- `checksec` — check binary mitigations
- `radare2` / `Ghidra` / `IDA Pro` — binary analysis/reversing
- `one_gadget` — find libc one-shot RCE gadgets
- `patchelf` — patch binary ELF (change linker/libc for local testing)
- `aflplusplus` — coverage-guided fuzzer for finding vulns

## References
- "Hacking: The Art of Exploitation" — Jon Erickson
- pwn.college — free binary exploitation course (Arizona State)
- LiveOverflow YouTube — binary exploitation series
- CTF writeups — ctftime.org for pwn challenges
