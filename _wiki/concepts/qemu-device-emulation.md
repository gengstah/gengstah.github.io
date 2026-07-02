---
title: "QEMU Device Emulation — Attack Surface for VM Escape & Device Fuzzing"
permalink: /wiki/concepts/qemu-device-emulation/
layout: single
author_profile: true
tags:
- concept
- vulnerability-research
- virtualization
---

> **Last updated:** 2026-07-02  
> **Related:** [PCI Configuration Space](/wiki/concepts/pci-configuration-space/), [Fuzzing (tools)](/wiki/tools/fuzzing/), [Windows Exploit Research Overview](/wiki/concepts/windows-exploit-research-overview/)  
> **Tags:** `virtualization`, `vulnerability-research`

## Summary

QEMU emulates hardware in host userspace, so a guest that can drive a virtual device's MMIO/PIO/DMA paths is effectively feeding attacker-controlled input to host C code — the classic VM-escape and device-fuzzing surface. Understanding how devices are registered and how guest accesses are dispatched to handlers tells you exactly where to point a fuzzer and where memory-safety bugs live.

---

## Full vs. Paravirtualised

- **Full virtualisation** — device logic lives entirely in host userspace (e.g. emulated `e1000`).
- **Paravirtualisation** — split across guest/host with a defined ABI; **virtio** is the common standard.

---

## QOM: Device Registration

Devices register through the **QEMU Object Model**. `type_init()` registers a `TypeInfo` (with `instance_init`, `instance_finalize`, and `class_init` callbacks); `type_register_static()` registers a base type that variants inherit from. The `class_init` callback sets device behaviour — for `e1000` it fills PCI fields (vendor/device IDs) and the `realize` function pointer.

## MMIO / PIO Region Setup

`memory_region_init_io()` binds a region to a `MemoryRegionOps` struct containing the read/write handlers (`e1000` binds `e1000_mmio_ops` and `e1000_io_ops`). `pci_register_bar()` then exposes those regions as PCI BARs, making them discoverable via [config space](/wiki/concepts/pci-configuration-space/). The `portio_list` API (`portio_list_add`, dispatched by `portio_read`/`portio_write`) is an alternative for fine-grained I/O-port handling.

> **These `MemoryRegionOps`/`portio` read/write callbacks are the primary fuzzing entry points** — every guest MMIO/PIO access is dispatched into one of them with guest-controlled offset and value.

## Virtio Path

Legacy virtio configures via I/O ports; modern virtio uses MMIO. `virtio_pci_device_plugged()` selects the mode. Modern devices map several sub-regions (common, isr, device, notify) into one consolidated BAR, each with its own ops (e.g. `virtio_pci_common_read`). Queues are registered with `virtio_add_queue()` and an output handler; for virtio-net, `rx_vq`/`tx_vq` bind `virtio_net_handle_rx` etc.

**Guest → host notify flow:**
```
guest writes virtio notify register
  → MemoryRegionOps dispatch → virtio_ioport_write()
    → case VIRTIO_PCI_QUEUE_NOTIFY: virtio_queue_notify()
      → vq->handle_output()   // e.g. queue 0 → virtio_net_handle_rx
```

---

## Where the Bugs Are

- **Ops handlers** — missing/incorrect bounds checks on guest-supplied offsets/lengths in MMIO/PIO read/write callbacks.
- **QOM inheritance** — type-confusion surface between base and variant device types.
- **Config-space handlers** — improper validation when the guest programs BARs/registers.
- **Malformed VirtQueue descriptors** — hostile descriptor rings passed to `handle_output` callbacks.

---

## References

- VictorV (@V-V), "QEMU虚拟化设备简介", v-v.space, 2023-02-22 — <https://v-v.space/2023/02/22/qemu-virtual-device-init/>
- QEMU source (`hw/net/e1000.c`, `hw/virtio/*`); QOM documentation
