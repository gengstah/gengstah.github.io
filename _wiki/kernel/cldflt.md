---
title: cldflt.sys — Windows Cloud Files Mini Filter Driver
permalink: /wiki/kernel/cldflt/
layout: single
author_profile: true
tags:
- windows-exploit-research
- kernel-mode
- kernel
redirect_from:
- /wiki/windows-exploit-research/kernel/cldflt/
---

> **Last updated:** 2026-04-10  
> **Related:** [Cve 2021 31969](/wiki/cves/CVE-2021-31969/), [Cve 2024 30085](/wiki/cves/CVE-2024-30085/), [Pool Internals](/wiki/kernel/pool_internals/), [Heap Grooming](/wiki/techniques/heap_grooming/), [Primitives](/wiki/kernel/primitives/)  
> **Tags:** `kernel-mode`, `heap-overflow`, `integer-overflow`, `pool`, `driver`

## Summary

`cldflt.sys` is the Windows Cloud Files Mini Filter Driver, responsible for processing placeholder files used by OneDrive and other cloud sync providers. It exposes an attack surface through **cloud file reparse points** — specially crafted data embedded in files that triggers parsing in the kernel when files are opened. Two CVEs (2021-31969 and 2024-30085) both originate from the same driver and the same general code path (`HsmpRpReadBuffer`), making cldflt a high-value target that has received patches on multiple consecutive Patch Tuesdays.

> **Note:** Researchers have observed that cldflt.sys has consistently received security patches every Patch Tuesday since 2021, suggesting ongoing researcher interest and Microsoft's reactive patching cadence — mirroring the earlier CLFS exploitation wave.

## Attack Surface

Any user-mode process can interact with cldflt.sys through the **Cloud Filter API** (cfapi.dll):

1. `CfRegisterSyncRoot(rootDir, ...)` — Register a sync provider root (no elevated privilege required)
2. `CfCreatePlaceholder(...)` / create files under the sync root
3. `DeviceIoControl(hFile, FSCTL_SET_REPARSE_POINT_EX, reparseData, ...)` — Attach arbitrary reparse data to a file
4. Reopen the file → triggers kernel parsing of reparse data → `HsmpRpReadBuffer → HsmpRpiDecompressBuffer`

**Key detail:** `FSCTL_SET_REPARSE_POINT` (the standard IOCTL) is blocked by the driver's pre-op handler for non-Cloud-Filter requests. Use `FSCTL_SET_REPARSE_POINT_EX` instead, which bypasses this check.

The trigger reparse tag is: **`IO_REPARSE_TAG_CLOUD_6 = 0x9000601a`**

## Reparse Point Data Format

```c
struct _HSM_REPARSE_DATA {
    DWORD Flags;
    DWORD Length;
    _HSM_DATA HsmData;
};

struct _HSM_DATA {
    DWORD  Magic;            // 0x70527442 ("BtRp") or 0x70526546 ("FeRp")
    DWORD  Crc32;
    DWORD  Length;
    DWORD  Flags;
    DWORD  NumberOfElements;
    _HSM_ELEMENT_INFO Elements[];
};

struct _HSM_ELEMENT_INFO {
    WORD  Type;    // element class
    WORD  Length;  // data length — attacker-controlled in both CVEs
    DWORD Offset;
};
```

### Element Types

| Value | Name | Notes |
|-------|------|-------|
| 0x00 | NONE | |
| 0x06 | UINT64 | |
| 0x07 | BYTE | |
| 0x0A | UINT32 | |
| 0x11 | BITMAP | Triggers `HsmIBitmapNORMALOpen` → CVE-2024-30085 |

### CVE-2021-31969 Custom Format

```c
struct cstmData {
    WORD flag;         // 0x8000 passes flag check
    WORD cstmDataSize; // 0x0000 triggers someSize=0 → underflow
    UCHAR compressedBuffer[];
};
```

## Kernel Call Stack

```
FltMgrFileOperationCompletion
 └─ HsmFltPostCREATE
     └─ HsmiFltPostECPCREATE
         └─ HsmpSetupContexts
             └─ HsmpRpReadBuffer        ← reads up to 0x4000 bytes of reparse data
                 └─ HsmpRpiDecompressBuffer  ← CVE-2021-31969: integer underflow here
                     └─ RtlDecompressBuffer(LZNT1, ...)
                 
HsmIBitmapNORMALOpen                   ← CVE-2024-30085: missing bounds check here
 └─ ExAllocatePoolWithTag('HsBm', 0x1000)
 └─ memcpy(HsBm->data, local_70, memcpy_size)  ← overflow
```

## CVE History

| CVE | Year | Bug | Alloc Size | Key Primitive |
|-----|------|-----|------------|---------------|
| CVE-2021-31969 | 2021 | `HIWORD` underflow → RtlDecompressBuffer ~4GB | 0x20 (HsRp) | Cross-subsegment LFH→VS overflow → WNF+TOKEN |
| CVE-2024-30085 | 2024 | Missing `> 0x1000` check on BITMAP element | 0x1000 (HsBm) | WNF DataSize corrupt → ALPC leak + PipeAttribute AAR → ALPC AAW |

Both CVEs exist in the same driver, triggered by the same API sequence, exploiting user-controlled length fields in reparse point structures.

## CVE-2021-31969 — Technical Summary

**Bug:** `someSize = HIWORD(v7)` with no lower bound → `allocatedSize = someSize + 8`; if `someSize < 4`, then `allocatedSize - 12` underflows to ~`0xFFFFFFF4` → `RtlDecompressBuffer` called with 4GB uncompressed size.

**LZNT1 Trick:** LZNT1 chunk header's high bit clear = uncompressed → `RtlDecompressBuffer` copies data verbatim (behaves as `memcpy`). Multiple LZNT1 chunks chain up to `HsmpRpReadBuffer`'s 0x4000 byte limit (~4 pages overflow).

**Allocation:** 0x20-byte paged pool chunk (tag `HsRp`). Falls in LFH — cannot overflow directly into WNF.

**Technique:** Spray `_TERMINATION_PORT` (0x20) to exhaust LFH buckets; spray WNF+TOKEN in VS subsegment; overflow past 4 LFH pages into VS subsegment → overwrite WNF.DataSize=0x1000.

**Post-overflow:** WNF relative read → TOKEN manipulation → AAR (`TokenBnoIsolation` path) + AAW (`SepAppendDefaultDacl` path) → PreviousMode=0 → token steal → SYSTEM.

**Patch:** `if (someSize < 4) return STATUS_INVALID_PARAMETER;`

See [Cve 2021 31969](/wiki/cves/CVE-2021-31969/) for full details.

## CVE-2024-30085 — Technical Summary

**Bug:** `HsmIBitmapNORMALOpen` allocates `HsBm` (0x1000 bytes, paged pool), then `memcpy(HsBm->data, src, memcpy_size)` with no upper bound check → overflow if `memcpy_size > 0x1000`.

**Allocation:** 0x1000-byte paged pool chunk (VS segment). Adjacent to other VS objects.

**Technique (two-phase):**
- Phase 1: Spray WNF (0x1000) + overflow → corrupt WNF.DataSize → OOB 8-byte read → leak KALPC_RESERVE pointer from adjacent ALPC handle table
- Phase 2: Second overflow → corrupt second WNF.DataSize → OOB write → Flink of adjacent PipeAttribute to fake userland object → arbitrary read via `NtFsControlFile(0x110038)` → EPROCESS→token address; then overwrite KALPC_RESERVE with fake → `NtAlpcSendWaitReceivePort` → ExtensionBuffer write → token privileges = 0xFF

**SMAP note:** Windows does not enable SMAP, so the kernel accesses fake objects in userland without issue.

**Patch:** `if (r14d > 0x1000) return STATUS_INVALID_PARAMETER;`

See [Cve 2024 30085](/wiki/cves/CVE-2024-30085/) for full details.

## Exploitation Primitives Map

| Primitive | CVE-2021-31969 | CVE-2024-30085 |
|-----------|---------------|----------------|
| Spray object (grooming) | `_TERMINATION_PORT` (0x20 LFH) + WNF + TOKEN (VS) | WNF (0x1000) + ALPC handle table (0x1000) + PipeAttribute |
| Kernel ptr leak | EtwR+0x30 via SESSION→AlIn→IoCo scan | KALPC_RESERVE ptr from adjacent ALPC handle table |
| Arbitrary read | NtQueryInformationToken(TokenBnoIsolation) | Fake PipeAttribute Flink → userland obj → NtFsControlFile(0x110038) |
| Arbitrary write | NtSetInformationToken(TokenDefaultDacl) → SepAppendDefaultDacl | Fake KALPC_RESERVE → fake KALPC_MESSAGE → NtAlpcSendWaitReceivePort ExtensionBuffer |
| Privilege escalation | PreviousMode=0 + token steal | Token privilege bitmap overwrite (Present/Enabled = 0xFF) |

## Grooming Strategy

### CVE-2021-31969 (0x20 LFH → VS overflow)

```
1. Spray _TERMINATION_PORT objects until LFH 0x20 bucket is exhausted → new LFH segment created
2. Spray WNF_STATE_DATA objects (DataSize=0xff0 → 0x1000 allocation) + TOKEN objects in VS
3. Exhaust VS subsegments → new VS subsegment allocated adjacent to new LFH segment
4. Trigger overflow → 4-page LZNT1 payload passes through LFH into VS subsegment
5. Overflow data = DWORD(0x1000) × n → WNF.AllocatedSize and WNF.DataSize both become 0x1000
```

### CVE-2024-30085 (0x1000 VS overflow)

```
Phase 1:
1. Spray 0x450 WNF_STATE_DATA objects (DataSize=0xff0, alloc=0x1000)
2. Free alternates → create 0x1000 holes
3. Trigger overflow → HsBm lands in hole, overflows 0x10 bytes into next WNF
4. Spray ALPC handle tables (grow to 0x1000 via NtAlpcCreateResourceReserve×127) into remaining holes
5. Find corrupted WNF (ChangeStamp sentinel check), read ptr at +0xff0

Phase 2:
6. Spray second WNF batch + free alternates
7. Trigger second overflow
8. Spray PipeAttribute (NtFsControlFile 0x11003c) into remaining holes
9. Use corrupted WNF OOB write to set PipeAttribute.Flink → fake userland PipeAttribute
10. Arbitrary read via NtFsControlFile(0x110038)
```

## Vulnerability Research Notes

- Both CVEs demonstrate that **reparse point element length fields** in cldflt.sys are systematically under-validated
- The 2021 vulnerability (0x20 chunk) required a novel technique (cross-subsegment overflow) that influenced subsequent kernel pool exploitation research
- The 2024 vulnerability reused established WNF/PipeAttribute/ALPC primitives, indicating these spray objects remain reliable across multiple Windows versions
- The ALPC handle table spray (variable size, max = 0x1000) was introduced as an alternative to WNF for the kernel pointer leak step

## References

- Alex Birnberg, "Exploitation of a kernel pool overflow from a restrictive chunk size (CVE-2021-31969)", SSD Blog
- Cherie-Anne Lee, "All I Want for Christmas is a CVE-2024-30085 Exploit", StarLabs, 2024-12
- Cloud Filter API docs: https://learn.microsoft.com/en-us/windows/win32/api/_cloudapi/
- FileTest HSM reparse structures: https://github.com/ladislav-zezula/FileTest/blob/master/ReparseDataHsm.h
