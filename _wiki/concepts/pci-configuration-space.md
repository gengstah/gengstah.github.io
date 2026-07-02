---
title: "PCI / PCIe Configuration Space"
permalink: /wiki/concepts/pci-configuration-space/
layout: single
author_profile: true
tags:
- windows-exploit-research
- concept
- hardware
---

> **Last updated:** 2026-07-02  
> **Related:** [QEMU Device Emulation](/wiki/concepts/qemu-device-emulation/), [Windows Exploit Research Overview](/wiki/concepts/windows-exploit-research-overview/)  
> **Tags:** `hardware`, `virtualization`

## Summary

PCI/PCIe configuration space is the standardised interface through which firmware and the OS discover, identify, and program hardware devices. It is foundational background for driver reverse-engineering, hypervisor/virtual-device work, and device-emulation fuzzing — you cannot reason about a device's MMIO attack surface without knowing how its BARs get assigned.

---

## Device Identification (BDF)

Every function is addressed by **Bus / Device / Function** (BDF). Its **Vendor ID** and **Device ID** are how the OS/UEFI match a driver to the hardware.

## Accessing Configuration Space

**Legacy (I/O ports).** Intel chipsets use port `0xCF8` (address) and `0xCFC` (data): write a 32-bit BDF+offset value to `0xCF8`, then read/write the register through `0xCFC`.

**PCIe (memory-mapped, ECAM/MMCFG).** PCIe expands config space from 256 bytes (PCI) to **4096 bytes** per function and requires it to be **directly memory-mapped**. Intel reserves a 256 MB MMCFG window; each function's config block sits at a unique address:

```
addr = MMCFG_base + (bus << 20) + (device << 15) + (function << 12) + offset
```

The MMCFG base is discovered from the ACPI **MCFG** table (reached via the RSDP, typically in `0xE0000–0xFFFFF` or the EBDA).

## Base Address Registers (BARs)

Config offsets `0x10–0x24` hold up to six 32-bit BARs describing MMIO/IO regions. A driver sizes a BAR by writing `0xFFFFFFFF`, reading back the masked value, then computing `~value + 1`. BAR contents are the physical addresses assigned to the device during enumeration — the endpoints an attacker's MMIO/PIO accesses land on.

## Capability Structures

Optional capabilities (MSI/MSI-X, power management, etc.) form a linked list starting at offset `0x34`; drivers traverse the `next-pointer` chain to find each.

## Linux Bring-up

```c
pci_enable_device(dev);     // power on, enable IO/mem decoding
pci_request_regions(dev);   // claim BAR ranges
ioremap(bar_phys, len);     // map BAR into kernel virtual space
pci_set_master(dev);        // enable bus-mastering for DMA
```

Also relevant: PCI-to-PCI bridges define resource-allocation windows, and root complexes use Address Translation Units (ATU) for inbound/outbound mapping; platform layout differs (e.g. ARM Cortex-A9 vs x86).

---

## Relevance to Offense

- **Emulator/hypervisor research** — accurate virtual devices must model config-space and BAR semantics; bugs in config-space handlers are an escape surface (see [QEMU Device Emulation](/wiki/concepts/qemu-device-emulation/)).
- **Driver exploitation** — config space is low-level device control; misconfiguration and DMA-capable devices open direct-memory attack paths.

---

## References

- VictorV (@V-V), "PCI 配置空间介绍", v-v.space, 2023-02-22 — <https://v-v.space/2023/02/22/PCI/>
- PCI / PCIe base specifications; Intel chipset datasheets; Linux kernel PCI subsystem
