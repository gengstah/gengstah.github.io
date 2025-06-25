---
permalink: /reversing/
title: "Reversing"
author_profile: true
---

{% include toc %}

# IDA Pro
- Options -> General
    - [x] Line prefies (graph)
    - [x] Auto comments
    - Number of opcode bytes: 6
    - Instruction indentation: 8

- Analyzing Functions
    - `Alt+P` - modify function options
    - **local variables**: negative offset relative to EBP
    - **arguments**: positive offset relative to EBP

- Using Named Constants
    - Right-click on a value -> Standard Symbolic Instance
    - To load a type library: View -> Open Subviews -> Type Libraries

- Redefining Code and Data
    - `U` - undefine functions, code, or data
    - `C` - define raw bytes as code
    - `D` - define raw bytes as data
    - `A` - define raw bytes as ASCII strings