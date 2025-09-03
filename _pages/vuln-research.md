---
permalink: /vuln-research/
title: "Vulnerability Research Notes"
author_profile: true
---

{% include toc %}

# Vulnerability Research Notes

## Code Review
**Taint Analysis**
- source - a location where untrusted or sensitive data enters a program
- sink - a sensitive point where this tainted data could cause a security vulnerability if not handled properly


**Sink-to-Source Analysis**
- Choosing the Right Sinks
    - https://learn.microsoft.com/en-us/windows-hardware/drivers/devtest/28719-banned-api-usage-use-updated-function-replacement
- Filtering for Exploitable Scenarios
- Confirming Exploitability
- Identifying an Attacker-Controlled Source
- Confirming a Reachable Attack Surface
- Testing the Exploit
- Building the Proof of Concept

**Static Code Analysis Tools**
- CodeQL - Multi-Repository Variant Analysis
- Semgrep - Single-Repository Variant Analysis

## Reverse Engineering
**Reverse Engineering Node.js Electron Applications**
- `$ dpkg-deb -x filename.deb outputfolder` - ./resources/app.asar

**Reverse Engineering a Python Application**
- `$ pip install pyinstaller`
- `$ pyi-archive_viewer main.exe`
- `? O PYZ-00.pyz`
- `? X models.button`

```
$ echo -n -e '\x6F\x0D\x0D\x0A' > fixed.models.button.pyc
$ printf '\x00%.0s' {1..12} >> fixed.models.button.pyc
$ cat models.button.pyc >> fixed.models.button.pyc
```

## Fuzzing
**Target Information**
- Black-box - Generates inputs for a program without a significant understanding of its implementation or internal structure
- Gray-box - Generates inputs for a program with a partial understanding of its implementation or internal structure, such as basic block-level code coverage through dynamic binary instrumentation
- White-box - Generates inputs for a program with a full understanding of its implementation or internal structure (in other words, the source code)

**Generation Approach**
- Mutation-based - Generates inputs by mutating an initial corpus of valid inputs.
- Generation-based - Generates inputs based on a predefined input format specification. For example, one subset of generation-based fuzzers is grammar-based fuzzers that define the syntax of valid inputs, such as valid symbols and sequences.

**Input Type**
- File fuzzers - Target file formats, including binary file formats such as
JPEG and text-based file formats like XML.
- Protocol fuzzers - Target network protocols, including multistep proto-
cols such as FTP.
- API fuzzers - Target web APIs by modifying the API request.

**Feedback Loop**
- Dumb - Uses simple feedback like crashes or hangs to identify successful test cases, but doesn’t use this information to prioritize these test cases for further input generation. For example, most general-use fuzzers flip bits or mutate basic data types like integers at random.
- Smart - Uses heuristics or coverage feedback to optimize input generation based on the exploration strategy. For example, coverage-guided fuzzers will prioritize seed inputs that create more coverage of the target program.


**Tools**

*Fuzzers*
- boofuzz - networking protocol fuzzing framework
- radamsa - general mutation-based fuzzer
- FormatFuzzer - file format fuzzer; uses Binary Template
- AFL++ - coverage-guided fuzzer
    - sdd

*Declarative binary structure template formats*
- Kaitai Struct
- 010 Editor Binary Template
- Peach Fuzzer's Peach Pit


**Fuzzing Optimizations**
- Patching Validation Checks
- Minimizing the Corpus
```
$ mv fuzz-out fuzz-out-2
$ afl-cmin -i test/test-data/2007 -o fuzz-in-cmin -- programs/dwgread @@
$ afl-fuzz -i fuzz-in-cmin -o fuzz-out -- programs/dwgread @@
```
- Writing a Harness
    - `LLVMFuzzerTestOneInput` function
- Fuzzing in Parallel




