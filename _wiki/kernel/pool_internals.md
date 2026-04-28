---
title: Windows Kernel Pool Internals
permalink: /wiki/kernel/pool_internals/
layout: single
author_profile: true
tags:
- windows-exploit-research
- kernel-mode
- kernel
redirect_from:
- /wiki/kernel/pool_internals/
---

> **Last updated:** 2026-04-10  
> **Related:** [Architecture](/wiki/kernel/architecture/), [Primitives](/wiki/kernel/primitives/), [Heap Grooming](/wiki/techniques/heap_grooming/), [Heap Internals](/wiki/usermode/heap_internals/)  
> **Tags:** `kernel-mode`, `pool`, `segment-heap`

## Summary

The kernel pool is the primary dynamic memory allocator in the Windows kernel — equivalent to the user-mode heap but for kernel objects. Understanding its internals is essential for pool overflow exploitation, pool grooming, and crafting reliable kernel exploits. Windows 20H1 (2004) introduced the Segment Heap to the kernel pool, fundamentally changing pool exploitation strategy.

---

## Legacy Pool (Pre-20H1)

### Pool Types
```c
typedef enum _POOL_TYPE {
    NonPagedPool         = 0,   // always resident in physical memory
    PagedPool            = 1,   // can be paged out
    NonPagedPoolNx       = 512, // NX (no-execute) non-paged pool
    NonPagedPoolNxSession = 640,
    PagedPoolSession     = 513,
    // ...
} POOL_TYPE;
```

**NX pools** (Win8+): `NonPagedPoolNx` replaces `NonPagedPool` as the safe default — allocations are non-executable. Using `NonPagedPool` is still possible but triggers security callbacks.

### Pool Header
Every allocation is preceded by a `_POOL_HEADER` (8 bytes, x64):
```c
typedef struct _POOL_HEADER {
    union {
        struct {
            ULONG PreviousSize : 8;   // size of previous block (in 16-byte units)
            ULONG PoolIndex    : 8;   // pool descriptor index
            ULONG BlockSize    : 8;   // size of this block (in 16-byte units)
            ULONG PoolType     : 8;   // pool type flags
        };
        ULONG Ulong1;
    };
    ULONG PoolTag;                    // 4-char tag, e.g., 'Proc', 'File'
} POOL_HEADER;
```

**Exploit relevance**: overflowing into the next chunk's `POOL_HEADER` allows controlling `BlockSize`, `PoolType`, and the `PoolTag` — classic pool overflow technique. With carefully crafted pool header, can redirect `ExFreePool` into overwriting controlled data.

### Free Lists and Lookaside Lists

**Look-aside lists** (per-CPU, per-size, fixed-size fast path): for small allocations (≤256 bytes). Uses `ExAllocateFromLookasideListEx` / `ExFreeToLookasideListEx`. Key for pool grooming — fill/drain these lists to control layout.

**Pool free list** (ListHeads): doubly-linked free list per size class. In pre-Win8 pool, exploiting the free list (similar to glibc unlink) was viable. Safe unlinking (Win8+) validates list pointers before unlink.

### Pool Grooming Strategy (Legacy)
1. **Spray**: fill target pool region with known-size controlled allocations
2. **Create holes**: free specific allocations to create correctly-sized holes
3. **Trigger allocation**: cause vulnerable object to land adjacent to attacker-controlled object
4. **Overflow**: corrupt next chunk's header or data

Tools for pool manipulation from user-mode: named pipes, event objects, socket buffers, registry keys, GDI objects, font objects.

---

## Segment Heap (Kernel, 20H1+)

### Overview
Windows 20H1 replaced the legacy pool allocator with a port of the user-mode **Segment Heap** (introduced in Win10 RS5 for user-mode). The kernel pool API (`ExAllocatePoolWithTag`, `ExFreePool`) is preserved — the change is internal.

Key security improvements:
- Pool header encoding (XOR with random cookie)
- Free list validation
- Heap metadata randomization
- Guard pages
- No contiguous metadata adjacent to user data (mitigating header overwrites)

### Segment Heap Components

```
_SEGMENT_HEAP
├── SegContexts[2]      ← VS segment (Variable Size) + backend
├── LargeAllocMetadata  ← RB tree of large allocations
├── LfhContext          ← Low Fragmentation Heap
└── BlockBitmap         ← Tracking bitmap
```

**VS segment** (Variable-Size): handles allocations that don't fit LFH buckets. Chunk header encoded with XOR cookie — overflowing into adjacent chunk is no longer straightforwardly exploitable without the cookie value.

**LFH (Low Fragmentation Heap)**: for allocations ≤ 16KB, organized into subsegments of fixed-size blocks. No chunk headers between user allocations — blocks are tracked via bitmap. This means pool overflows into adjacent LFH blocks hit user data directly, not headers.

**Large allocations** (>128KB): metadata stored separately in `LargeAllocMetadata` RB tree. Overflow into adjacent large alloc doesn't corrupt metadata.

### Encoded VS Chunk Header
```c
// Kernel segment heap chunk header (simplified)
typedef struct _HEAP_VS_CHUNK_HEADER {
    union {
        ULONG_PTR EncodedSegmentPageOffset;  // XOR'd with heap key
        struct {
            ULONG_PTR MemoryCost     : 1;
            ULONG_PTR UnsafeSize     : 15;
            ULONG_PTR UnsafePrevSize : 15;
            ULONG_PTR Allocated      : 1;
            ULONG_PTR KeyShifted     : 32;  // upper 32 bits of cookie
        };
    };
} HEAP_VS_CHUNK_HEADER;
```

To exploit a VS chunk overflow, you need the heap encoding key — which requires a prior information leak.

### New Pool Exploitation Strategies (Post-20H1)

1. **LFH exploitation**: overflow within LFH subsegment → adjacent blocks have no headers → overflow directly into object data. No cookie needed if both objects are in same LFH bucket.

2. **Cross-cache attacks**: cause vulnerable allocation and target object to land in same LFH subsegment by controlling allocation timing and sizing.

3. **TypeIndex re-use / object confusion**: corrupt object body (not header) to achieve type confusion → controlled dispatch.

4. **Free list poisoning via info leak**: leak heap cookie → craft malicious VS chunk header → arbitrary write via controlled coalesce.

5. **Bitmap manipulation**: corrupt LFH subsegment bitmap → cause double-allocate of same slot → UAF primitive.

6. **CLFS BLF parser as grooming trigger**: CLFS metadata block allocations are triggered entirely by user-supplied BLF file content and sizing — attacker controls allocation sizes and timing by crafting the BLF. This makes CLFS an unusually controllable pool allocation source for grooming. See [Clfs](/wiki/kernel/clfs/).

---

## Pool Tagging

Every allocation has a 4-byte tag. Useful for exploitation and research:

```
'Proc' - EPROCESS
'Thre' - ETHREAD  
'File' - FILE_OBJECT
'Irp ' - IRP
'Even' - EVENT
'Muta' - MUTANT
'Semf' - SEMAPHORE
'Port' - PORT_MESSAGE
'NpFr' - Named Pipe (useful for grooming)
'User' - win32k user objects
'Gdi ' - GDI objects
```

Use `!pool` in WinDbg to inspect pool allocations. `!poolused` shows tag statistics.

---

## Heap Spray / Grooming Objects

Best objects for kernel pool grooming (user-mode controlled):

| Object | Pool | Size | Control | How to allocate |
|--------|------|------|---------|-----------------|
| `PIPE_ATTRIBUTE` | Paged/NP | Variable | Fully controlled body | NtSetInformationFile on named pipe |
| `KCONSOLE_INPUT` | NonPaged | Variable | Controlled | CreateConsoleScreenBuffer |
| Named pipe write buffer | Paged | Controlled | Data payload | WriteFile to blocking named pipe |
| Event objects | NonPaged | 0x40 | Limited | NtCreateEvent |
| Semaphore objects | NonPaged | 0x40 | Limited | NtCreateSemaphore |
| Registry key value data | Paged | Variable | Controlled | NtSetValueKey |
| `FAKE_FILE_HANDLE` | Paged | 0x40 | Limited | NtCreateFile |
| Desktop heap objects | Session | Variable | Various | Windows user objects |
| `tagWND` | Session | ~0x100 | Partial | CreateWindow |

---

## Exploit Relevance

- Legacy pool exploitation (pre-20H1) relies on pool header overwrites — simple but mitigated on modern targets
- Segment Heap (20H1+) requires info leak + cookie bypass OR LFH-targeted grooming
- Named pipes remain the best grooming primitive due to size flexibility and paged pool placement
- Pool feng shui (precise layout control) is a prerequisite for reliable kernel exploits

---

## References
- "Kernel Pool Exploitation on Windows 7" — Tarjei Mandt (Morten)
- "Windows Kernel Pool Spraying Fun" — CoreSecurity
- "Segment Heap Internals" — Mark Vincent Yason, Black Hat 2016
- "Exploiting Windows Kernel Pool Using a Segment Heap" — Valentina Palmiotti, OffensiveCon 2021
- "Pool Party" — SafeBreach (2023) — Windows thread pool object grooming
