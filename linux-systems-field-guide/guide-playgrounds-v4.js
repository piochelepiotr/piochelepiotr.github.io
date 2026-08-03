"use strict";

const c = (slug, label) => `<a class="concept-link" href="#${slug}" data-route="${slug}">${label}</a>`;
const code = (label, source) => `
  <div class="code-block">
    <span class="code-label">${label}</span>
    <pre><code>${source}</code></pre>
  </div>`;
const callout = (title, body, kind = "") => `
  <aside class="callout ${kind}"><strong>${title}</strong><p>${body}</p></aside>`;
const practiceNote = (body) => `
  <aside class="practice-note"><span class="label">In practice</span><p>${body}</p></aside>`;
const diagram = (...nodes) => `
  <div class="diagram flow-diagram" style="--flow-count:${nodes.length}"><div class="diagram-row">${nodes
    .map((node, index) => `${index ? `<span class="diagram-arrow" style="--flow-index:${index - 0.5}">→</span>` : ""}<span class="diagram-node ${node.accent ? "accent" : ""}" style="--flow-index:${index}">${node.text}</span>`)
    .join("")}</div></div>`;

const groups = [
  {
    title: "Orientation",
    entries: [
      {
        slug: "readme",
        title: "Read this first",
        question: "How does a C program become a running Linux process?",
        summary: "A connected guide to the machinery beneath ordinary C: compilation, ELF, virtual memory, threads, signals, hooks, and the kernel boundary.",
        body: `
          <p>A systems program lives at the intersection of several contracts. The C language defines expressions and objects. The compiler turns them into machine code. The ABI says how separately compiled code cooperates. ELF stores that code. The dynamic loader assembles it into a process. The kernel supplies memory, threads, files, signals, and system calls.</p>

          ${diagram(
            { text: "C source" },
            { text: "object files" },
            { text: "ELF executable / .so", accent: true },
            { text: "mapped process" },
            { text: "threads + syscalls" }
          )}

          <h2>A useful reading order</h2>
          <p>This guide is deliberately not alphabetical. Read it from top to bottom once. After that, use the search box and the linked terms as a map.</p>
          <div class="path-grid">
            <a class="path-card" href="#translation-unit" data-route="translation-unit"><strong>1. Build a program</strong><p>From source files to symbols, object files, and ELF.</p><span>Start the build path →</span></a>
            <a class="path-card" href="#program-startup" data-route="program-startup"><strong>2. Start a process</strong><p>Loading, address spaces, stacks, environment, and limits.</p><span>Follow program startup →</span></a>
            <a class="path-card" href="#pthreads" data-route="pthreads"><strong>3. Add concurrency</strong><p>Threads, synchronization, atomics, TLS, and fork hazards.</p><span>Enter concurrency →</span></a>
            <a class="path-card" href="#symbol-interposition" data-route="symbol-interposition"><strong>4. Instrument it</strong><p>Interposition, PLT/GOT hooks, trampolines, and ABI rules.</p><span>Understand instrumentation →</span></a>
          </div>

          <h2>Three boundaries to keep straight</h2>
          <div class="fact-grid">
            <div class="fact-card"><strong>Language vs. implementation</strong><p>ISO C does not define pthreads, ELF, <code>fork()</code>, or <code>mmap()</code>. Those arrive from POSIX, Linux, libc, and compiler extensions.</p></div>
            <div class="fact-card"><strong>Process vs. thread</strong><p>A process owns an address space and resources. Threads are execution streams sharing most of that state.</p></div>
            <div class="fact-card"><strong>Kernel vs. libc</strong><p>A C program usually calls a libc wrapper. The wrapper may issue a syscall, use the vDSO, cache state, or do substantial work itself.</p></div>
            <div class="fact-card"><strong>API vs. ABI</strong><p>The API is what source code calls. The ABI is the binary-level agreement that lets independently built pieces actually work together.</p></div>
          </div>

          ${callout("The core debugging habit", `When behavior is surprising, ask which layer owns it: ${c("c-language", "C")}, the compiler, the ${c("abi", "ABI")}, ${c("elf", "ELF")}, ${c("dynamic-loader", "the loader")}, libc, or the kernel.`)}
        `,
        connections: ["c-language", "abi", "elf", "program-startup", "syscalls"],
        refs: [
          ["The Linux Programming Interface", "https://man7.org/tlpi/"],
          ["Linux man-pages", "https://man7.org/linux/man-pages/"],
          ["Computer Systems: A Programmer’s Perspective", "https://csapp.cs.cmu.edu/"]
        ]
      },
      {
        slug: "c-language",
        title: "C, as the machine sees it",
        question: "What does “advanced C” really mean?",
        summary: "C exposes storage, representation, lifetime, and undefined behavior more directly than most languages—but it is still an abstract machine, not portable assembly.",
        body: `
          <p>C gives you values, objects, types, storage durations, and expressions. The compiler may translate them however it wants as long as the observable behavior matches the standard—assuming the program has no undefined behavior.</p>
          <h2>The concepts that matter most</h2>
          <ul>
            <li><strong>Object lifetime:</strong> when storage contains a valid object of a particular type.</li>
            <li><strong>Storage duration:</strong> automatic, static, allocated, or thread-local.</li>
            <li><strong>Pointer provenance and aliasing:</strong> which memory a pointer is allowed to identify and which types may access it.</li>
            <li><strong>Undefined behavior:</strong> operations for which C imposes no requirements, allowing optimizers to assume they never occur.</li>
            <li><strong>Data races:</strong> conflicting unsynchronized accesses are undefined behavior, not merely “occasionally stale.”</li>
          </ul>
          ${code("C · lifetime and address", `static int process_wide;       // static storage duration
_Thread_local int per_thread;  // thread storage duration

void f(void) {
    int local = 0;              // automatic storage duration
    int *heap = malloc(sizeof *heap); // allocated storage
    /* each pointer names storage with different lifetime rules */
    free(heap);
}`)}
          ${callout("Portable C is not the whole system", `GNU attributes such as <code>weak</code>, <code>constructor</code>, and <code>cleanup</code>, inline assembly, ELF visibility, and raw syscalls are implementation extensions. Treat each as an explicit portability decision.`, "warning")}
          ${practiceNote(`Production systems libraries often concentrate atomic, locking, and platform details in small compatibility headers so the rest of the code can use a narrower, reviewed contract.`)}
        `,
        connections: ["translation-unit", "abi", "atomics", "thread-local-storage", "undefined-behavior"],
        refs: [
          ["SEI CERT C Coding Standard", "https://wiki.sei.cmu.edu/confluence/display/c"],
          ["GCC C extensions", "https://gcc.gnu.org/onlinedocs/gcc/C-Extensions.html"]
        ]
      },
      {
        slug: "abi",
        title: "ABI",
        question: "How can code compiled separately agree at runtime?",
        summary: "An Application Binary Interface fixes the invisible rules: calling convention, register use, data layout, symbol format, stack alignment, and executable format.",
        body: `
          <p>An API says “call this function with these C types.” An ABI says where arguments go, who saves each register, how the return value comes back, how structures are laid out, and what the stack must look like at the call boundary.</p>
          <h2>A function call is a protocol</h2>
          ${diagram(
            { text: "caller places arguments" },
            { text: "call transfers control", accent: true },
            { text: "callee preserves required registers" },
            { text: "return value + restored stack" }
          )}
          <p>On x86-64 Linux, the System V ABI commonly passes initial integer or pointer arguments in registers such as <code>rdi</code>, <code>rsi</code>, and <code>rdx</code>. AArch64 uses <code>x0</code> through <code>x7</code>. Exact details matter when writing ${c("trampolines", "trampolines")}, unwinding stacks, or calling functions through manually resolved pointers.</p>
          <h2>ABI compatibility is more than function signatures</h2>
          <p>Changing structure layout, enum width, symbol visibility, alignment, or ownership rules can break binary consumers without producing a compiler error. C ABIs are especially exposed because shared libraries exchange raw addresses and layouts.</p>
          ${practiceNote(`Hook trampolines need architecture-specific implementations precisely because register assignments, instruction encodings, and call-boundary rules differ.`)}
        `,
        connections: ["calling-convention", "elf", "symbols", "trampolines", "stack-unwinding"],
        refs: [
          ["System V AMD64 ABI", "https://gitlab.com/x86-psABIs/x86-64-ABI"],
          ["Arm ABI specifications", "https://github.com/ARM-software/abi-aa"]
        ]
      }
    ]
  },
  {
    title: "Build & Link",
    entries: [
      {
        slug: "translation-unit",
        title: "Translation units",
        question: "What does the compiler actually compile?",
        summary: "After preprocessing, each C source file becomes an independent translation unit. Declarations connect units at compile time; symbols connect them at link time.",
        body: `
          <p>The preprocessor expands <code>#include</code>, macros, and conditional compilation into one stream of tokens. The compiler sees that result—not your original tree of headers.</p>
          ${diagram(
            { text: "file.c + headers" },
            { text: "preprocessor" },
            { text: "translation unit", accent: true },
            { text: "assembler" },
            { text: "file.o" }
          )}
          <h2>Declarations are promises</h2>
          <p>A declaration tells the compiler a name and type exist. A definition supplies storage or code. If different translation units disagree about a function type, the linker may still connect the names while the ${c("abi", "ABI")} interaction is invalid.</p>
          ${code("Shell · inspect each stage", `cc -E source.c -o source.i     # preprocessed source
cc -S source.c -o source.s     # generated assembly
cc -c source.c -o source.o     # relocatable object
readelf -Ws source.o           # symbol table`)}
          <h2>Header discipline is systems discipline</h2>
          <p>Headers should express stable interfaces, include what they use, prevent repeated inclusion, and avoid definitions that accidentally create multiple external symbols. Feature-test macros must be defined before system headers.</p>
        `,
        connections: ["object-files", "symbols", "linking", "c-language"],
        refs: [["GCC: Overall Options", "https://gcc.gnu.org/onlinedocs/gcc/Overall-Options.html"]]
      },
      {
        slug: "object-files",
        title: "Object files",
        question: "What lives inside a .o file?",
        summary: "A relocatable object contains machine code and data, plus symbols and relocation instructions telling the linker what is still unresolved.",
        body: `
          <p>Compiling one translation unit does not assign final virtual addresses. Calls and data references that cross object boundaries remain symbolic. The object records enough information for the linker to finish the job.</p>
          <h2>Typical contents</h2>
          <div class="fact-grid">
            <div class="fact-card"><strong><code>.text</code></strong><p>Executable machine instructions.</p></div>
            <div class="fact-card"><strong><code>.rodata</code></strong><p>Read-only constants and strings.</p></div>
            <div class="fact-card"><strong><code>.data</code> / <code>.bss</code></strong><p>Initialized and zero-initialized writable globals.</p></div>
            <div class="fact-card"><strong>Symbols + relocations</strong><p>Named definitions/references and places that require address adjustment.</p></div>
          </div>
          ${callout("Sections are the linker’s view", `At runtime, the kernel and ${c("dynamic-loader", "dynamic loader")} primarily map <em>segments</em>, not individual sections. This distinction makes many ELF diagrams finally click.`)}
          ${code("Shell · useful inspection tools", `file libobserve.so
readelf -hWSr libobserve.so
nm -D --defined-only libobserve.so
objdump -drwC object.o`)}
        `,
        connections: ["elf", "symbols", "relocations", "linking"],
        refs: [["ELF object file format", "https://refspecs.linuxfoundation.org/elf/gabi4+/contents.html"]]
      },
      {
        slug: "elf",
        title: "ELF",
        question: "What is an executable or shared library on Linux?",
        summary: "ELF is the container format for relocatable objects, executables, shared objects, and core dumps. It serves both link-time and runtime views.",
        body: `
          <p>An ELF header identifies the architecture, byte order, file type, and entry point. Section headers organize material for linking and debugging. Program headers describe the segments that form a running process image.</p>
          ${diagram(
            { text: "ELF header" },
            { text: "program headers", accent: true },
            { text: "loadable bytes" },
            { text: "section headers" }
          )}
          <div class="terminal-figure">
            <div class="terminal-titlebar"><span class="terminal-dots"><i></i><i></i><i></i></span>example ELF file · bytes laid out on disk</div>
            <div class="terminal-body">
              <div class="memory-table">
                <div class="memory-row header"><span class="memory-cell">file offset</span><span class="memory-cell">interpreted as</span><span class="memory-cell">who needs it</span></div>
                <div class="memory-row"><span class="memory-cell">0x0000</span><span class="memory-cell">ELF header</span><span class="memory-cell">kernel/linker: architecture, entry point, table locations</span></div>
                <div class="memory-row"><span class="memory-cell">0x0040</span><span class="memory-cell">program headers</span><span class="memory-cell">kernel/loader: which byte ranges become mappings</span></div>
                <div class="memory-row"><span class="memory-cell">0x1000</span><span class="memory-cell">.text</span><span class="memory-cell">CPU instructions in an R-X mapping</span></div>
                <div class="memory-row"><span class="memory-cell">0x3000</span><span class="memory-cell">.rodata</span><span class="memory-cell">constants in an R-- mapping</span></div>
                <div class="memory-row"><span class="memory-cell">0x4000</span><span class="memory-cell">.data + .bss</span><span class="memory-cell">globals in RW- memory; .bss zeros need no file bytes</span></div>
                <div class="memory-row"><span class="memory-cell">0x5000</span><span class="memory-cell">section headers</span><span class="memory-cell">linker/debugger: names and link-time organization</span></div>
              </div>
            </div>
            <figcaption class="terminal-caption">Offsets are positions inside the file. Virtual addresses are positions inside the running process. A <code>PT_LOAD</code> header connects the two.</figcaption>
          </div>
          <div class="terminal-figure">
            <div class="terminal-titlebar"><span class="terminal-dots"><i></i><i></i><i></i></span>one PT_LOAD mapping · file → virtual memory</div>
            <div class="step-trace">
              <div class="trace-step"><span class="trace-number">1</span><strong>read header</strong><p><code>p_offset=0x1000</code>, <code>p_vaddr=0x401000</code>, <code>p_filesz=0x900</code>, <code>p_memsz=0x900</code>, flags <code>R-X</code>.</p></div>
              <div class="trace-step"><span class="trace-number">2</span><strong>create mapping</strong><p>File bytes at offset <code>0x1000</code> appear beginning at virtual address <code>0x401000</code>.</p></div>
              <div class="trace-step"><span class="trace-number">3</span><strong>enforce access</strong><p>The CPU may fetch instructions and read data from these pages, but a write causes a protection fault.</p></div>
            </div>
          </div>
          <h2>Sections versus segments</h2>
          <p>Sections answer “what kind of link-time information is this?” Segments answer “which byte ranges should be mapped together, with which permissions?” Several sections may occupy one loadable segment.</p>
          <p>Important program-header types include <code>PT_LOAD</code>, <code>PT_DYNAMIC</code>, <code>PT_INTERP</code>, <code>PT_TLS</code>, and <code>PT_GNU_RELRO</code>. Their presence guides ${c("program-startup", "program startup")}, ${c("dynamic-loader", "dynamic linking")}, and ${c("thread-local-storage", "TLS initialization")}.</p>
          ${code("Shell · see both views", `readelf -S program    # sections: linker/debugger view
readelf -l program    # segments: loader view
readelf -d program    # dynamic linking metadata
readelf -n program    # notes and build ID`)}
          ${practiceNote(`Instrumentation libraries often inspect loaded program headers through <code>dl_iterate_phdr()</code>. For them, ELF is not incidental packaging; it is part of the runtime design.`)}
        `,
        connections: ["object-files", "linking", "dynamic-loader", "virtual-memory", "thread-local-storage"],
        refs: [
          ["elf(5)", "https://man7.org/linux/man-pages/man5/elf.5.html"],
          ["ELF program loading", "https://refspecs.linuxfoundation.org/elf/gabi4+/ch5.intro.html"]
        ]
      },
      {
        slug: "symbols",
        title: "Symbols",
        question: "How does a name become an address?",
        summary: "Symbols label functions and objects for linkers and loaders. Binding, visibility, versioning, and lookup scope determine which definition wins.",
        body: `
          <p>A symbol table entry includes a name, type, binding, visibility, section, value, and size. Local symbols stay within an object. Global symbols participate in linking. Weak symbols may remain unresolved or lose to a strong definition.</p>
          <h2>Static and dynamic symbol tables</h2>
          <p><code>.symtab</code> is the fuller link/debug table and may be stripped. <code>.dynsym</code> contains symbols needed at runtime. A symbol can exist in one and not the other.</p>
          <div class="system-lab" data-lab="symbol-scope"></div>
          ${code("C · optional dependency", `extern int optional_feature(void) __attribute__((weak));

if (optional_feature != NULL) {
    optional_feature();
}`)}
          ${callout("Weak is not lazy", `A weak declaration changes resolution rules; it does not itself load a library. ${c("dlopen", "dlopen() and dlsym()")} are the explicit runtime-loading interface.`)}
          ${practiceNote(`Injected runtimes use weak declarations for optional libraries and entry points so one build can operate in hosts with different loaded components.`)}
        `,
        connections: ["linking", "relocations", "dynamic-loader", "symbol-interposition", "dlopen"],
        refs: [["ELF symbol table", "https://refspecs.linuxfoundation.org/elf/gabi4+/ch4.symtab.html"]]
      },
      {
        slug: "linking",
        title: "Static and dynamic linking",
        question: "When are references connected to definitions?",
        summary: "Static linking copies selected object code into an output file. Dynamic linking records dependencies and defers part of symbol resolution and relocation until runtime.",
        body: `
          <p>The static linker combines relocatable objects, chooses definitions, lays out sections, applies resolvable relocations, and emits an executable or shared object. Archives (<code>.a</code>) are indexed collections of object files; shared libraries (<code>.so</code>) remain separate runtime objects.</p>
          ${diagram(
            { text: "objects + archives" },
            { text: "ld / linker", accent: true },
            { text: "executable + DT_NEEDED" },
            { text: "runtime loader + .so files" }
          )}
          <h2>Position-independent code</h2>
          <p>A shared library cannot assume one load address. PIC reaches code and data through relative addressing and indirection structures such as the ${c("plt-got", "GOT and PLT")}. PIE applies the relocatable model to the main executable.</p>
          <h2>Order can matter</h2>
          <p>Traditional archive processing is left-to-right: an archive supplies members needed by unresolved references seen so far. Shared-library options such as <code>--as-needed</code>, symbol visibility, and version scripts further shape the exported ABI.</p>
          ${code("Shell · reveal dependencies", `cc -fPIC -c hook.c
cc -shared -Wl,-soname,libhook.so.1 -o libhook.so.1 hook.o
readelf -d libhook.so.1
ldd ./program`)}
        `,
        connections: ["object-files", "symbols", "relocations", "dynamic-loader", "plt-got"],
        refs: [
          ["GNU ld manual", "https://sourceware.org/binutils/docs/ld/"],
          ["Program loading and dynamic linking", "https://refspecs.linuxfoundation.org/elf/gabi4+/ch5.intro.html"]
        ]
      },
      {
        slug: "relocations",
        title: "Relocations",
        question: "How are unknown addresses repaired?",
        summary: "A relocation identifies a place whose final value depends on a symbol or load address. Linkers and loaders calculate and write the required value.",
        body: `
          <p>Machine instructions and data frequently contain addresses or offsets. When the compiler cannot know the final value, it emits a relocation describing the calculation rather than guessing.</p>
          ${diagram(
            { text: "offset to patch" },
            { text: "+ symbol value" },
            { text: "+ load base / addend", accent: true },
            { text: "final machine value" }
          )}
          <p>Some relocations are resolved by the static linker. Dynamic relocations remain in the ELF file for the loader. Relative relocations adjust for the chosen load base; symbol relocations require lookup across loaded objects.</p>
          ${callout("Why hooks care", `Changing symbol resolution or a ${c("plt-got", "GOT slot")} changes where a relocation-mediated call lands. Inline hooks instead modify the function’s machine instructions and therefore operate below normal relocation machinery.`)}
          ${code("Shell · inspect relocations", `readelf -rW object.o
readelf -rW shared-library.so
objdump -dr object.o`)}
        `,
        connections: ["symbols", "elf", "dynamic-loader", "plt-got", "symbol-interposition"],
        refs: [["ELF relocations", "https://fasterthanli.me/series/making-our-own-executable-packer/part-4"]]
      }
    ]
  },
  {
    title: "Process & Memory",
    entries: [
      {
        slug: "program-startup",
        title: "Program startup",
        question: "What happens before main()?",
        summary: "execve replaces a process image; the kernel maps the initial ELF segments and interpreter, then the loader relocates objects and runtime startup code eventually calls main.",
        body: `
          <p>The shell normally creates a child and invokes <code>execve()</code>. The kernel discards the old userspace image, validates the executable, establishes a new address space and initial stack, and transfers control either to the program or its ELF interpreter.</p>
          ${diagram(
            { text: "execve()" },
            { text: "kernel maps ELF + stack" },
            { text: "ld-linux relocates", accent: true },
            { text: "constructors" },
            { text: "main()" }
          )}
          <p>The initial stack carries <code>argc</code>, <code>argv</code>, environment strings, and an auxiliary vector with values such as page size, program-header location, and random bytes. libc startup initializes its runtime before calling user <code>main()</code>.</p>
          <h2>Constructors run in a delicate phase</h2>
          <p>Functions marked with a constructor attribute run before <code>main()</code> when their object is initialized. Dependencies may not be in the state ordinary application code expects. Reentrancy and loader-lock interactions deserve special care.</p>
          ${practiceNote(`An auto-instrumentation library starts inside arbitrary host programs, often through ${c("symbol-interposition", "LD_PRELOAD")}. Its bootstrap code must assume very little about the host’s startup state.`)}
        `,
        connections: ["elf", "dynamic-loader", "process-address-space", "stack", "environment"],
        refs: [
          ["execve(2)", "https://man7.org/linux/man-pages/man2/execve.2.html"],
          ["getauxval(3)", "https://man7.org/linux/man-pages/man3/getauxval.3.html"]
        ]
      },
      {
        slug: "process-address-space",
        title: "Process address space",
        question: "What does a pointer actually point into?",
        summary: "Each process has a virtual address space made of mappings. Page tables translate virtual addresses to physical memory or other backing stores and enforce permissions.",
        body: `
          <p>A pointer usually contains a virtual address meaningful only in its process. The kernel manages mappings; the CPU’s memory-management unit translates and checks each access using page tables.</p>
          <div class="diagram">
            <div class="diagram-row"><span class="diagram-node">high addresses<br><strong>thread stacks</strong></span></div>
            <div class="diagram-row"><span class="diagram-node accent">shared libraries · mmap regions</span></div>
            <div class="diagram-row"><span class="diagram-node">heap ↑</span></div>
            <div class="diagram-row"><span class="diagram-node">data · rodata · text<br>low addresses</span></div>
          </div>
          <p>This picture is conceptual, not a promised ordering. ASLR randomizes placement; architectures and runtimes differ; mappings may be sparse. Inspect reality through <code>/proc/&lt;pid&gt;/maps</code>.</p>
          ${code("Shell · inspect one process", `cat /proc/self/maps
pmap -X $PID
readelf -l /proc/$PID/exe`)}
          <h2>Copy-on-write</h2>
          <p>After ${c("fork", "fork()")}, parent and child initially share physical pages. Writable pages are logically private; a write triggers a private copy. The virtual addresses can remain identical even after their contents diverge.</p>
        `,
        connections: ["virtual-memory", "mmap", "stack", "fork", "procfs"],
        refs: [
          ["proc_pid_maps(5)", "https://man7.org/linux/man-pages/man5/proc_pid_maps.5.html"],
          ["proc_pid_smaps(5)", "https://man7.org/linux/man-pages/man5/proc_pid_smaps.5.html"]
        ]
      },
      {
        slug: "virtual-memory",
        title: "Virtual memory and pages",
        question: "Why can mapped memory exist without consuming RAM yet?",
        summary: "Virtual memory separates address ranges from physical storage. Pages are populated, protected, shared, reclaimed, and faulted independently.",
        body: `
          <p>Creating a virtual mapping reserves an address range and defines how accesses should be handled. Physical pages can be attached lazily on first access. A page fault is the CPU asking the kernel to resolve an access—not automatically an application error.</p>
          <div class="system-lab" data-lab="page-decoder"></div>
          <div class="terminal-figure">
            <div class="terminal-titlebar"><span class="terminal-dots"><i></i><i></i><i></i></span>load byte at virtual address 0x7f12_3456_078a</div>
            <div class="step-trace">
              <div class="trace-step"><span class="trace-number">1</span><strong>split address</strong><p>The CPU separates virtual page number <code>0x7f12_34560</code> from within-page offset <code>0x78a</code>.</p></div>
              <div class="trace-step"><span class="trace-number">2</span><strong>translate page</strong><p>The MMU consults cached translation state and page tables: virtual page <code>0x7f12_34560</code> → physical frame <code>0x12ab9</code>, permissions <code>R--</code>.</p></div>
              <div class="trace-step"><span class="trace-number">3</span><strong>form physical address</strong><p>Keep the same offset: physical frame base <code>0x12ab9000</code> + <code>0x78a</code> = <code>0x12ab978a</code>.</p></div>
              <div class="trace-step"><span class="trace-number">4</span><strong>read cache / RAM</strong><p>The CPU fetches the byte. If the page-table entry were absent, it would enter the kernel’s page-fault handler instead.</p></div>
            </div>
            <figcaption class="terminal-caption">With a 4 KiB page, the low 12 address bits are the offset. Translation changes the page number, not the offset within the page.</figcaption>
          </div>
          <div class="terminal-figure">
            <div class="terminal-titlebar"><span class="terminal-dots"><i></i><i></i><i></i></span>two virtual pages can refer to one physical frame</div>
            <div class="terminal-body">
              <div class="memory-table">
                <div class="memory-row header"><span class="memory-cell">process</span><span class="memory-cell">virtual page</span><span class="memory-cell">physical backing</span></div>
                <div class="memory-row"><span class="memory-cell">process A</span><span class="memory-cell">0x7f12_34560</span><span class="memory-cell">frame 0x12ab9 · shared libc code · R-X</span></div>
                <div class="memory-row"><span class="memory-cell">process B</span><span class="memory-cell">0x7ea0_81120</span><span class="memory-cell">frame 0x12ab9 · same physical bytes · R-X</span></div>
              </div>
            </div>
          </div>
          <h2>Minor, major, and invalid faults</h2>
          <ul>
            <li>A <strong>minor fault</strong> can be satisfied without reading storage, such as allocating a zero-filled anonymous page.</li>
            <li>A <strong>major fault</strong> requires I/O.</li>
            <li>An invalid access may produce <code>SIGSEGV</code> or <code>SIGBUS</code>.</li>
          </ul>
          <p>Page size affects alignment, protection granularity, mapping layout, and hook patching. Query it instead of assuming 4096 bytes.</p>
          ${code("C · page size", `long page_size = sysconf(_SC_PAGESIZE);
if (page_size == -1) {
    /* handle error */
}`)}
          ${callout("Reserved is not resident", `A large thread stack mapping or anonymous mapping does not necessarily consume the same amount of physical RAM. Virtual size, resident set size, and committed memory answer different questions.`)}
        `,
        connections: ["process-address-space", "mmap", "stack", "signals"],
        refs: [["proc(5)", "https://man7.org/linux/man-pages/man5/proc.5.html"]]
      },
      {
        slug: "mmap",
        title: "mmap and memory protection",
        question: "How does a process create and control mappings?",
        summary: "mmap creates file-backed or anonymous mappings; mprotect changes page permissions; munmap removes mappings. Alignment and sharing flags define the contract.",
        body: `
          <p><code>mmap()</code> returns a page-aligned virtual range or <code>MAP_FAILED</code>. <code>MAP_PRIVATE</code> creates copy-on-write modifications; <code>MAP_SHARED</code> makes writes visible through the shared mapping and potentially the backing file.</p>
          ${code("C · anonymous mapping", `void *p = mmap(NULL, length,
    PROT_READ | PROT_WRITE,
    MAP_PRIVATE | MAP_ANONYMOUS,
    -1, 0);
if (p == MAP_FAILED) {
    /* inspect errno */
}`)}
          <h2>W^X and generated code</h2>
          <p>Write xor execute is the security principle that a page should not be writable and executable simultaneously. JITs and ${c("trampolines", "hook trampolines")} often allocate writable pages, emit instructions, flush architecture-required instruction caches, then change the mapping to executable.</p>
          ${callout("Permissions operate on pages", `Changing protection for a few instruction bytes affects the containing pages. Concurrent threads executing those pages make patching a synchronization problem as well as a memory problem.`, "warning")}
          ${practiceNote(`A portable hook engine must create executable trampoline storage while accounting for platform-specific mechanisms such as macOS <code>MAP_JIT</code> and Linux memory mappings.`)}
        `,
        connections: ["virtual-memory", "trampolines", "signals", "syscalls"],
        refs: [
          ["mmap(2)", "https://man7.org/linux/man-pages/man2/mmap.2.html"],
          ["mprotect(2)", "https://man7.org/linux/man-pages/man2/mprotect.2.html"]
        ]
      },
      {
        slug: "stack",
        title: "Stacks and stack limits",
        question: "Is there one stack size for a Linux process?",
        summary: "Every thread has its own stack. The initial thread and pthread-created threads acquire their sizes through related but distinct mechanisms.",
        body: `
          <p>A stack holds call frames, saved registers, return addresses, and many automatic objects. It normally grows downward on common Linux architectures, but portable C does not promise that direction.</p>
          <div class="system-lab" data-lab="stack-budget"></div>
          <div class="terminal-figure">
            <div class="terminal-titlebar"><span class="terminal-dots"><i></i><i></i><i></i></span>x86-64 example · main calls parse(42)</div>
            <div class="terminal-body">
              <div class="memory-table">
                <div class="memory-row header"><span class="memory-cell">virtual address</span><span class="memory-cell">stack bytes mean</span><span class="memory-cell">who placed them</span></div>
                <div class="memory-row"><span class="memory-cell">0x7fff…fef8</span><span class="memory-cell">0x000000000040117b</span><span class="memory-cell">return address pushed by <code>call parse</code></span></div>
                <div class="memory-row"><span class="memory-cell">0x7fff…fef0</span><span class="memory-cell">old frame pointer</span><span class="memory-cell"><code>push %rbp</code> in parse prologue</span></div>
                <div class="memory-row"><span class="memory-cell">0x7fff…feec</span><span class="memory-cell">local int result</span><span class="memory-cell">space reserved by <code>sub $0x20,%rsp</code></span></div>
                <div class="memory-row"><span class="memory-cell">0x7fff…fed0</span><span class="memory-cell">padding / other locals</span><span class="memory-cell">compiler’s frame layout</span></div>
              </div>
              <div class="boundary-label">stack grows toward lower addresses ↓</div>
              <div class="state-row"><span class="state-key">RSP</span><span class="state-value changed">0x7fff…fed0 — current stack top</span></div>
              <div class="state-row"><span class="state-key">RBP</span><span class="state-value">0x7fff…fef0 — frame base, if frame pointers are enabled</span></div>
              <div class="state-row"><span class="state-key">RDI</span><span class="state-value">42 — first integer argument is in a register, not necessarily on the stack</span></div>
            </div>
            <figcaption class="terminal-caption"><code>ret</code> pops the saved address <code>0x40117b</code> into RIP, so execution resumes immediately after the original <code>call</code>.</figcaption>
          </div>
          <h2>The initial thread</h2>
          <p><code>RLIMIT_STACK</code> limits the main thread’s stack growth and also constrains argument and environment space for <code>execve()</code>. The shell’s <code>ulimit -s</code> commonly changes its soft limit.</p>
          <h2>New pthreads</h2>
          <p>When the process starts with a finite <code>RLIMIT_STACK</code>, NPTL uses that value as the default stack size for new threads. Otherwise it uses an architecture-specific default. Crucially, changing the limit later does not necessarily change pthread defaults: the initial limit is captured at program startup.</p>
          ${code("C · explicit thread stack size", `pthread_attr_t attr;
pthread_attr_init(&attr);
pthread_attr_setstacksize(&attr, 2 * 1024 * 1024);
pthread_create(&thread, &attr, worker, arg);
pthread_attr_destroy(&attr);`)}
          ${callout("Guard pages", `A pthread stack normally includes an inaccessible guard region intended to turn overflow into a fault. A ${c("signal-handlers", "SIGSEGV handler")} cannot reliably run on the exhausted stack; use ${c("alternate-signal-stack", "sigaltstack()")} for that case.`, "warning")}
        `,
        connections: ["resource-limits", "pthreads", "virtual-memory", "alternate-signal-stack", "stack-unwinding"],
        refs: [
          ["pthread_create(3)", "https://man7.org/linux/man-pages/man3/pthread_create.3.html"],
          ["getrlimit(2)", "https://man7.org/linux/man-pages/man2/getrlimit.2.html"]
        ]
      },
      {
        slug: "resource-limits",
        title: "Resource limits",
        question: "What do soft and hard limits control?",
        summary: "rlimits are per-process ceilings inherited across fork and preserved across exec. A process may lower its soft limit within the hard limit.",
        body: `
          <p><code>getrlimit()</code>, <code>setrlimit()</code>, and Linux <code>prlimit()</code> operate on named resources. The soft limit is enforced; the hard limit is the ceiling an unprivileged process may set for the soft limit.</p>
          <div class="fact-grid">
            <div class="fact-card"><strong><code>RLIMIT_STACK</code></strong><p>Main stack and exec argument/environment space.</p></div>
            <div class="fact-card"><strong><code>RLIMIT_NOFILE</code></strong><p>One greater than the highest allocatable file descriptor.</p></div>
            <div class="fact-card"><strong><code>RLIMIT_CORE</code></strong><p>Maximum core-dump size.</p></div>
            <div class="fact-card"><strong><code>RLIMIT_AS</code></strong><p>Maximum process virtual address space.</p></div>
          </div>
          <p>Limits are not usage counters. A 128 MiB stack limit does not say 128 MiB is resident. Container, cgroup, overcommit, and system-wide limits may impose additional constraints.</p>
          ${code("Shell · observe limits", `ulimit -a
cat /proc/self/limits
prlimit --pid $PID`)}
        `,
        connections: ["stack", "file-descriptors", "fork", "program-startup"],
        refs: [["getrlimit(2)", "https://man7.org/linux/man-pages/man2/getrlimit.2.html"]]
      },
      {
        slug: "environment",
        title: "The process environment",
        question: "Why are environment variables shared state?",
        summary: "The environment is a process-wide array of name/value strings inherited across fork and supplied to exec. libc mutation APIs introduce concurrency and lifetime hazards.",
        body: `
          <p>The initial environment arrives with the new process image. <code>getenv()</code> searches process-global state. <code>setenv()</code>, <code>unsetenv()</code>, and <code>putenv()</code> mutate it and can invalidate assumptions made by concurrent readers or cached pointers.</p>
          ${callout("Snapshot early, read immutably", `A runtime injected into a multithreaded host is safer when it captures configuration once and exposes immutable reads. It also needs a deliberate policy for what happens after ${c("fork", "fork()")} and across reinitialization.`)}
          <h2>Security-sensitive execution</h2>
          <p>The dynamic loader ignores or strips several <code>LD_*</code> variables in secure-execution mode, such as for set-user-ID binaries. Environment-driven injection is intentionally constrained at trust boundaries.</p>
          ${practiceNote(`Injected runtimes commonly expose configuration through an immutable environment snapshot. Adding raw <code>getenv()</code> reads or later environment mutation would race that model.`)}
        `,
        connections: ["program-startup", "fork", "dynamic-loader", "async-signal-safety"],
        refs: [
          ["environ(7)", "https://man7.org/linux/man-pages/man7/environ.7.html"],
          ["secure_getenv(3)", "https://man7.org/linux/man-pages/man3/secure_getenv.3.html"]
        ]
      },
      {
        slug: "procfs",
        title: "procfs",
        question: "How does /proc expose a running process?",
        summary: "/proc is a kernel-generated pseudo-filesystem. Per-process files expose mappings, descriptors, limits, metadata, threads, and status without being ordinary disk files.",
        body: `
          <p><code>/proc/self</code> resolves to the reading process. <code>/proc/thread-self</code> identifies the reading thread. Files are generated from current kernel state and may change between reads.</p>
          <div class="fact-grid">
            <div class="fact-card"><strong><code>maps</code> / <code>smaps</code></strong><p>Mappings, permissions, backing paths, and memory accounting.</p></div>
            <div class="fact-card"><strong><code>fd/</code></strong><p>Symlinks representing open file descriptors.</p></div>
            <div class="fact-card"><strong><code>status</code> / <code>stat</code></strong><p>Identity, state, signals, capabilities, and counters.</p></div>
            <div class="fact-card"><strong><code>cmdline</code> / <code>environ</code></strong><p>NUL-separated startup arguments and current environment.</p></div>
          </div>
          ${callout("Treat reads as observations", `Processes exit, descriptors close, mappings change, and permissions restrict visibility. Code must tolerate short reads, disappearing paths, and partial snapshots.`)}
          ${practiceNote(`Observability libraries often read <code>/proc/self/cmdline</code> and <code>/proc/self/comm</code> for process metadata and launcher heuristics.`)}
        `,
        connections: ["process-address-space", "file-descriptors", "resource-limits", "pthreads"],
        refs: [["proc(5)", "https://man7.org/linux/man-pages/man5/proc.5.html"]]
      },
      {
        slug: "file-descriptors",
        title: "File descriptors",
        question: "Why are sockets, pipes, and files all integers?",
        summary: "A file descriptor indexes a process table entry referring to an open file description. Duplicated descriptors can share offset and status flags while retaining descriptor-local flags.",
        body: `
          <p>A file descriptor is just a small non-negative integer in your program—often <code>0</code>, <code>1</code>, <code>2</code>, or <code>3</code>. It is <strong>not a pointer</strong>, does not contain the file’s bytes, and does not contain a pathname. The kernel uses it as an array index.</p>
          <div class="timeline-demo" data-timeline="fd"></div>
          <div class="system-lab" data-lab="fd-table"></div>

          <h2>What is physically stored in the C variable?</h2>
          <div class="terminal-figure">
            <div class="terminal-titlebar"><span class="terminal-dots"><i></i><i></i><i></i></span>userspace · int fd = open("notes.txt", O_RDONLY)</div>
            <div class="terminal-body">
              <div class="state-row"><span class="state-key">open returned</span><span class="state-value changed">3</span></div>
              <div class="state-row"><span class="state-key">C type</span><span class="state-value">int — commonly four bytes</span></div>
              <div class="state-row"><span class="state-key">example bytes</span><span class="state-value"><span class="byte-strip"><span class="byte">03</span><span class="byte">00</span><span class="byte">00</span><span class="byte">00</span></span>little-endian representation of integer 3</span></div>
              <div class="state-row"><span class="state-key">what it means</span><span class="state-value">“use slot 3 in this process’s kernel-managed descriptor table”</span></div>
            </div>
            <figcaption class="terminal-caption">The local variable may live in a register or in userspace memory. Either way, its useful content is only the number <code>3</code>.</figcaption>
          </div>

          <h2>What does the number lead to?</h2>
          <div class="terminal-figure">
            <div class="terminal-titlebar"><span class="terminal-dots"><i></i><i></i><i></i></span>conceptual lookup · read(3, buffer, 100)</div>
            <div class="terminal-body">
              <div class="layer-stack">
                <div class="layer"><span class="layer-name">userspace</span><span class="layer-value"><code>fd = 3</code> — plain integer passed in syscall register <code>rdi</code></span></div>
                <div class="boundary-label">syscall boundary</div>
                <div class="layer"><span class="layer-name">process</span><span class="layer-value"><code>files → fdtable → fd[3]</code></span></div>
                <div class="layer"><span class="layer-name">fd slot 3</span><span class="layer-value"><span class="pointer">pointer →</span> kernel <code>struct file</code> at an inaccessible kernel address</span></div>
                <div class="layer"><span class="layer-name">open file</span><span class="layer-value">current offset, open flags, operations, path/inode or socket-specific state</span></div>
                <div class="layer"><span class="layer-name">resource</span><span class="layer-value">regular file · socket · pipe · eventfd · device · epoll instance</span></div>
              </div>
            </div>
            <figcaption class="terminal-caption">The exact kernel structures are implementation details. The stable model is: integer → per-process descriptor slot → open file description → underlying resource.</figcaption>
          </div>

          <h2>A concrete descriptor table</h2>
          <div class="terminal-figure">
            <div class="terminal-titlebar"><span class="terminal-dots"><i></i><i></i><i></i></span>process 4217 · kernel-owned fd table</div>
            <div class="terminal-body">
              <div class="memory-table">
                <div class="memory-row header"><span class="memory-cell">index / fd</span><span class="memory-cell">slot contains</span><span class="memory-cell">open file description</span></div>
                <div class="memory-row"><span class="memory-cell">0</span><span class="memory-cell">pointer 0xffff…a100</span><span class="memory-cell">terminal · read side · stdin</span></div>
                <div class="memory-row"><span class="memory-cell">1</span><span class="memory-cell">pointer 0xffff…a180</span><span class="memory-cell">terminal · write side · stdout</span></div>
                <div class="memory-row"><span class="memory-cell">2</span><span class="memory-cell">pointer 0xffff…a200</span><span class="memory-cell">terminal · write side · stderr</span></div>
                <div class="memory-row"><span class="memory-cell">3</span><span class="memory-cell">pointer 0xffff…b740</span><span class="memory-cell">notes.txt · offset 0 · O_RDONLY</span></div>
                <div class="memory-row"><span class="memory-cell">4</span><span class="memory-cell">NULL</span><span class="memory-cell">unused slot</span></div>
              </div>
            </div>
            <figcaption class="terminal-caption">The shown kernel pointers are invented examples and cannot be dereferenced from userspace. <code>FD_CLOEXEC</code> is descriptor-local state commonly represented separately from the <code>struct file *</code> array.</figcaption>
          </div>

          <h2>What might the open file description remember?</h2>
          <div class="terminal-figure">
            <div class="terminal-titlebar"><span class="terminal-dots"><i></i><i></i><i></i></span>conceptual struct file · not a stable userspace layout</div>
            <div class="terminal-body">
              <div class="memory-table">
                <div class="memory-row header"><span class="memory-cell">field concept</span><span class="memory-cell">example value</span><span class="memory-cell">meaning</span></div>
                <div class="memory-row"><span class="memory-cell">file position</span><span class="memory-cell">128</span><span class="memory-cell">next regular-file read begins at byte 128</span></div>
                <div class="memory-row"><span class="memory-cell">status flags</span><span class="memory-cell">O_RDONLY</span><span class="memory-cell">access mode and flags such as O_APPEND</span></div>
                <div class="memory-row"><span class="memory-cell">operations</span><span class="memory-cell">pointer → file ops</span><span class="memory-cell">which kernel read/write/poll implementation to call</span></div>
                <div class="memory-row"><span class="memory-cell">path / inode</span><span class="memory-cell">pointer → VFS objects</span><span class="memory-cell">which filesystem object this open instance refers to</span></div>
                <div class="memory-row"><span class="memory-cell">reference count</span><span class="memory-cell">1</span><span class="memory-cell">how many references keep this open instance alive</span></div>
                <div class="memory-row"><span class="memory-cell">private data</span><span class="memory-cell">type-specific pointer</span><span class="memory-cell">socket, device, or filesystem-specific state</span></div>
              </div>
            </div>
          </div>

          <p>Linux models many I/O resources through this mechanism: regular files, sockets, pipes, eventfds, epoll instances, and more. The integer is merely the userspace handle; kernel memory carries the state.</p>
          <h2>Descriptor versus open file description</h2>
          <p><code>dup()</code> and <code>fork()</code> can create multiple descriptors referencing the same open file description, so they share the file offset and status flags. Here is why that changes observable behavior:</p>
          <div class="terminal-figure">
            <div class="terminal-titlebar"><span class="terminal-dots"><i></i><i></i><i></i></span>dup shares the open description</div>
            <div class="step-trace">
              <div class="trace-step"><span class="trace-number">1</span><strong><code>fd3 = open(...)</code></strong><p>Table slot 3 points to open description A. A’s file offset is <code>0</code>; reference count is <code>1</code>.</p></div>
              <div class="trace-step"><span class="trace-number">2</span><strong><code>fd4 = dup(fd3)</code></strong><p>Kernel puts the same pointer in slot 4. Both <code>fd[3]</code> and <code>fd[4]</code> point to A; reference count becomes <code>2</code>.</p></div>
              <div class="trace-step"><span class="trace-number">3</span><strong><code>read(fd3, b, 100)</code></strong><p>Kernel reads bytes 0–99 through A and changes A’s shared offset to <code>100</code>.</p></div>
              <div class="trace-step"><span class="trace-number">4</span><strong><code>read(fd4, b, 20)</code></strong><p>This also uses A, so it starts at byte 100—not byte 0—and leaves the shared offset at <code>120</code>.</p></div>
              <div class="trace-step"><span class="trace-number">5</span><strong><code>close(fd3)</code></strong><p>Slot 3 becomes empty and A’s reference count falls to 1. The file stays open through slot 4.</p></div>
            </div>
          </div>
          <p><code>FD_CLOEXEC</code> belongs to the descriptor slot and controls survival across <code>execve()</code>; it is not a status flag shared through the open file description.</p>
          ${code("C · avoid the exec race", `int fd = open(path, O_RDONLY | O_CLOEXEC);
int socket_fd = socket(AF_INET, SOCK_STREAM | SOCK_CLOEXEC, 0);`)}
          <p>Setting close-on-exec atomically during creation avoids a race where another thread calls <code>fork()</code> plus <code>execve()</code> between creation and a later <code>fcntl()</code>.</p>
          ${practiceNote(`An injected library’s transport code works with sockets inside arbitrary hosts, where descriptor leaks, recursion through hooks, and post-fork state all matter.`)}
        `,
        connections: ["syscalls", "fork", "resource-limits", "symbol-interposition"],
        refs: [
          ["open(2)", "https://man7.org/linux/man-pages/man2/open.2.html"],
          ["fcntl(2)", "https://man7.org/linux/man-pages/man2/fcntl.2.html"]
        ]
      }
    ]
  },
  {
    title: "Threads & State",
    entries: [
      {
        slug: "pthreads",
        title: "POSIX threads",
        question: "What does a thread share—and what is private?",
        summary: "Threads share a process address space, code, heap, descriptors, and signal dispositions, while keeping their own registers, stack, scheduling state, errno, and signal mask.",
        body: `
          <p><code>pthread_create()</code> adds an execution stream to the process. Either thread may run first. Returning from the start routine terminates that thread; returning from <code>main()</code> behaves like <code>exit()</code> and terminates the process.</p>
          <div class="terminal-figure">
            <div class="terminal-titlebar"><span class="terminal-dots"><i></i><i></i><i></i></span>one process · three scheduled threads</div>
            <div class="terminal-body">
              <div class="state-split">
                <section class="state-panel">
                  <h3>Shared address space</h3>
                  <div class="state-row"><span class="state-key">.text</span><span class="state-value">same machine instructions</span></div>
                  <div class="state-row"><span class="state-key">globals</span><span class="state-value">same bytes and addresses</span></div>
                  <div class="state-row"><span class="state-key">heap</span><span class="state-value">same allocations</span></div>
                  <div class="state-row"><span class="state-key">fd table</span><span class="state-value">same descriptor slots</span></div>
                </section>
                <section class="state-panel">
                  <h3>Thread A · B · C each own</h3>
                  <div class="state-row"><span class="state-key">registers</span><span class="state-value">different RIP/RSP/general registers</span></div>
                  <div class="state-row"><span class="state-key">stack</span><span class="state-value">different mapped range</span></div>
                  <div class="state-row"><span class="state-key">TLS</span><span class="state-value">different object instances</span></div>
                  <div class="state-row"><span class="state-key">signal mask</span><span class="state-value">different blocked set</span></div>
                </section>
              </div>
            </div>
            <figcaption class="terminal-caption">The scheduler pauses one thread by saving its registers and resumes another by restoring that thread’s registers. Switching threads does not switch the process address space.</figcaption>
          </div>
          <div class="fact-grid">
            <div class="fact-card"><strong>Shared</strong><p>Virtual memory, globals, heap, file descriptors, current directory, signal dispositions.</p></div>
            <div class="fact-card"><strong>Per-thread</strong><p>Registers, stack, signal mask, scheduling attributes, <code>errno</code>, thread-local storage.</p></div>
          </div>
          <p>A joinable thread retains termination metadata until another thread joins it. A detached thread releases that state automatically and cannot be joined.</p>
          ${code("C · lifecycle", `pthread_t thread;
int rc = pthread_create(&thread, NULL, worker, context);
if (rc != 0) { /* rc is the error number */ }

void *result;
rc = pthread_join(thread, &result);`)}
          ${callout("pthread errors are unusual", `Most pthread functions return an error number directly rather than returning <code>-1</code> and setting <code>errno</code>. Always check the contract for the specific function.`)}
        `,
        connections: ["synchronization", "atomics", "thread-local-storage", "stack", "fork"],
        refs: [
          ["pthreads(7)", "https://man7.org/linux/man-pages/man7/pthreads.7.html"],
          ["pthread_create(3)", "https://man7.org/linux/man-pages/man3/pthread_create.3.html"]
        ]
      },
      {
        slug: "synchronization",
        title: "Mutexes, conditions, and once",
        question: "How do threads establish a correct order?",
        summary: "Synchronization provides mutual exclusion and happens-before relationships. Mutexes protect invariants; condition variables wait for state changes; once controls initialization.",
        body: `
          <p>A mutex should protect an invariant, not just a variable. Lock acquisition and release also establish memory-order relationships so writes in one critical section become visible to the next owner.</p>
          <h2>Condition variables wait for predicates</h2>
          ${code("C · always loop", `pthread_mutex_lock(&lock);
while (!work_available) {
    pthread_cond_wait(&condition, &lock);
}
take_work();
pthread_mutex_unlock(&lock);`)}
          <p>The loop handles spurious wakeups and the fact that another thread may consume the condition before this waiter reacquires the mutex. The shared predicate—not the signal—is the truth.</p>
          <h2>Once initialization</h2>
          <p><code>pthread_once()</code> guarantees an initialization routine completes once before successful callers proceed. POSIX does not offer a portable “reset once” operation. Forking during or after initialization can therefore require careful design.</p>
          ${callout("Never copy a live mutex", `Synchronization objects are not ordinary bytes. Reinitializing, moving, destroying, or copying them is valid only under the API’s specific lifecycle rules.`, "warning")}
          ${practiceNote(`Long-lived native libraries often combine mutexes, condition variables, once initialization, and explicit child repair after fork.`)}
        `,
        connections: ["pthreads", "atomics", "fork", "c-memory-model"],
        refs: [
          ["pthread_mutex_lock(3p)", "https://man7.org/linux/man-pages/man3/pthread_mutex_lock.3p.html"],
          ["pthread_cond_wait(3)", "https://man7.org/linux/man-pages/man3/pthread_cond_wait.3.html"],
          ["pthread_once(3p)", "https://man7.org/linux/man-pages/man3/pthread_once.3p.html"]
        ]
      },
      {
        slug: "c-memory-model",
        title: "The C memory model",
        question: "Why is “the CPU probably does this” not enough?",
        summary: "The language memory model determines whether concurrent accesses form a data race and which values may be observed. Compiler and CPU ordering are separate layers constrained by it.",
        body: `
          <p>Two conflicting accesses target the same memory location, at least one is a write, and they are not ordered by happens-before. If they are non-atomic, that is a data race and the C program has undefined behavior.</p>
          <h2>Three kinds of ordering</h2>
          <ul>
            <li><strong>Source order:</strong> how expressions appear in C.</li>
            <li><strong>Compiler order:</strong> the optimizer may reorder or remove operations under language rules.</li>
            <li><strong>Hardware order:</strong> CPUs and caches may make memory operations visible in different orders.</li>
          </ul>
          <p>A compiler barrier is not necessarily a hardware fence. <code>volatile</code> is not a threading primitive. Mutexes and C atomics provide language-level synchronization that implementations map appropriately to the target.</p>
          ${callout("Start strong, weaken with proof", `Sequentially consistent atomics are easier to reason about. Acquire/release and relaxed operations can be valuable, but each weaker order should correspond to a written synchronization argument.`)}
        `,
        connections: ["atomics", "synchronization", "undefined-behavior", "pthreads"],
        refs: [["GCC memory model", "https://gcc.gnu.org/wiki/Atomic/GCCMM"]]
      },
      {
        slug: "atomics",
        title: "Atomics",
        question: "What does an atomic operation guarantee?",
        summary: "Atomics prevent tearing and data races for their object, while memory orders control how surrounding operations synchronize across threads.",
        body: `
          <p>Atomicity is not the same as ordering, and one atomic variable does not automatically make a larger invariant safe. A compare-exchange is a read-modify-write with a success order, a failure order, and possible retry.</p>
          <div class="fact-grid">
            <div class="fact-card"><strong>Relaxed</strong><p>Atomic value updates with no cross-object synchronization.</p></div>
            <div class="fact-card"><strong>Acquire</strong><p>Later operations cannot move before; can observe a release sequence.</p></div>
            <div class="fact-card"><strong>Release</strong><p>Earlier operations become visible to a matching acquire.</p></div>
            <div class="fact-card"><strong>Sequential consistency</strong><p>Adds one global order for SC operations.</p></div>
          </div>
          ${code("C · publish immutable state", `_Atomic(struct config *) global_config;

/* publisher */
atomic_store_explicit(&global_config, ready, memory_order_release);

/* reader */
struct config *p = atomic_load_explicit(
    &global_config, memory_order_acquire);`)}
          <p>If the acquire reads the released pointer, initialization sequenced before the release becomes visible to that reader. Object lifetime still needs a separate policy if the pointer may later be freed.</p>
          ${practiceNote(`Systems libraries often wrap atomic operations used by hooks and runtime state. The wrapper’s memory order is part of its correctness contract, not a performance decoration.`)}
        `,
        connections: ["c-memory-model", "synchronization", "pthreads", "undefined-behavior"],
        refs: [["atomic operations — cppreference C", "https://en.cppreference.com/w/c/atomic"]]
      },
      {
        slug: "thread-local-storage",
        title: "Thread-local storage",
        question: "How can one global-looking name have one value per thread?",
        summary: "TLS gives each thread a distinct instance of an object. ELF, the loader, libc, and architecture-specific thread-pointer conventions cooperate to make access fast.",
        body: `
          <p>C11 <code>_Thread_local</code> and GNU <code>__thread</code> declare thread-storage duration. The source name is shared, but its address and stored value differ by thread.</p>
          ${diagram(
            { text: "TLS template in ELF" },
            { text: "loader assigns module data" },
            { text: "thread pointer + offset", accent: true },
            { text: "per-thread object" }
          )}
          <p>TLS access models trade flexibility for speed. Code linked with a variable at startup can use more direct models than code loaded later. Static TLS space is finite in important configurations, which is why <code>dlopen()</code> and TLS model choices sometimes interact unexpectedly.</p>
          <h2>TLS after fork</h2>
          <p>The child retains only the calling thread, whose TLS values are copied from the parent. Any value encoding process identity or random-stream state may need reinitialization.</p>
          ${practiceNote(`ID generators should reseed thread-local state after fork so parent and child do not continue identical random sequences.`)}
        `,
        connections: ["elf", "dynamic-loader", "pthreads", "fork", "abi"],
        refs: [
          ["ELF handling for TLS", "https://www.akkadia.org/drepper/tls.pdf"],
          ["pthread_key_create(3)", "https://man7.org/linux/man-pages/man3/pthread_key_create.3.html"]
        ]
      },
      {
        slug: "fork",
        title: "fork in a multithreaded process",
        question: "Why is the child born with locked locks?",
        summary: "fork duplicates the calling thread and process state, but no other threads. Mutexes and once state may therefore refer to owners that no longer exist.",
        body: `
          <p>After <code>fork()</code>, the child contains one thread: the caller. Memory is a copy-on-write snapshot of the entire process, including synchronization bytes written by vanished threads.</p>
          ${diagram(
            { text: "parent: threads A B C" },
            { text: "A calls fork()", accent: true },
            { text: "child: only A, copied locks" }
          )}
          <div class="terminal-figure">
            <div class="terminal-titlebar"><span class="terminal-dots"><i></i><i></i><i></i></span>state at the instant thread A calls fork</div>
            <div class="state-split">
              <section class="state-panel">
                <h3>Parent immediately before</h3>
                <div class="state-row"><span class="state-key">thread A</span><span class="state-value">running fork</span></div>
                <div class="state-row"><span class="state-key">thread B</span><span class="state-value">owns mutex M</span></div>
                <div class="state-row"><span class="state-key">thread C</span><span class="state-value">waiting on condition</span></div>
                <div class="state-row"><span class="state-key">mutex M bytes</span><span class="state-value">locked · owner = B</span></div>
              </section>
              <section class="state-panel">
                <h3>Child immediately after</h3>
                <div class="state-row"><span class="state-key">thread A</span><span class="state-value changed">exists · fork returns 0</span></div>
                <div class="state-row"><span class="state-key">thread B</span><span class="state-value changed">does not exist</span></div>
                <div class="state-row"><span class="state-key">thread C</span><span class="state-value changed">does not exist</span></div>
                <div class="state-row"><span class="state-key">mutex M bytes</span><span class="state-value changed">still say locked by B</span></div>
              </section>
            </div>
            <figcaption class="terminal-caption">The child receives copied memory, not a semantic reconstruction of every library object. No vanished thread can ever execute an unlock.</figcaption>
          </div>
          <div class="terminal-figure">
            <div class="terminal-titlebar"><span class="terminal-dots"><i></i><i></i><i></i></span>copy-on-write page after fork</div>
            <div class="step-trace">
              <div class="trace-step"><span class="trace-number">1</span><strong>before either writes</strong><p>Parent virtual page <code>0x7000</code> and child virtual page <code>0x7000</code> both map physical frame A as read-only/COW.</p></div>
              <div class="trace-step"><span class="trace-number">2</span><strong>child writes</strong><p>The write triggers a page fault. The kernel allocates frame B, copies A’s bytes into B, and maps the child page writable to B.</p></div>
              <div class="trace-step"><span class="trace-number">3</span><strong>after the write</strong><p>Parent still sees frame A. Child sees frame B. Both pointers can have numeric value <code>0x7000</code> while naming different physical bytes.</p></div>
            </div>
          </div>
          <p>If B held a mutex at the instant of the fork, the child’s copied mutex may remain locked forever. Library background-thread state, condition variables, once controls, allocators, and network connections can all become inconsistent.</p>
          <h2>pthread_atfork</h2>
          <p>Handlers run before the fork, then in parent and child. They can coordinate application-owned locks, but composing independently registered handlers is difficult because prepare handlers run in reverse registration order while parent/child handlers run forward.</p>
          ${callout("The strict post-fork window", `Before an immediate <code>execve()</code>, a child of a multithreaded process should call only async-signal-safe functions. Repairing a complex injected runtime for continued execution is necessarily platform-specific and demands tight control.`, "warning")}
          ${practiceNote(`Injected runtimes may need child handlers that reset mutexes, background-worker state, metadata caches, and TLS-derived IDs because a host may fork and continue without exec.`)}
        `,
        connections: ["pthreads", "synchronization", "async-signal-safety", "thread-local-storage", "program-startup"],
        refs: [
          ["fork(2)", "https://man7.org/linux/man-pages/man2/fork.2.html"],
          ["pthread_atfork(3)", "https://man7.org/linux/man-pages/man3/pthread_atfork.3.html"]
        ]
      }
    ]
  },
  {
    title: "Signals & Failure",
    entries: [
      {
        slug: "signals",
        title: "Signals",
        question: "Are signals interrupts, events, or exceptions?",
        summary: "Signals are asynchronous process notifications with per-process dispositions and per-thread masks. Delivery chooses an eligible thread and temporarily redirects its execution.",
        body: `
          <p>A signal is generated, becomes pending, and is delivered when an eligible thread does not block it. Its disposition may ignore it, perform the default action, or invoke a user handler.</p>
          <div class="terminal-figure">
            <div class="terminal-titlebar"><span class="terminal-dots"><i></i><i></i><i></i></span>SIGUSR1 delivery · what happens to thread B</div>
            <div class="step-trace">
              <div class="trace-step"><span class="trace-number">1</span><strong>signal generated</strong><p>Another process calls <code>kill(pid, SIGUSR1)</code>. The kernel marks SIGUSR1 pending for the target process.</p></div>
              <div class="trace-step"><span class="trace-number">2</span><strong>choose a thread</strong><p>Thread A blocks SIGUSR1; thread B does not. The kernel chooses B when it is ready to return to userspace.</p></div>
              <div class="trace-step"><span class="trace-number">3</span><strong>build signal frame</strong><p>On B’s stack, the kernel saves B’s register state: old RIP, RSP, flags, signal mask, and architecture context.</p></div>
              <div class="trace-step"><span class="trace-number">4</span><strong>redirect execution</strong><p>The kernel changes B’s userspace RIP to a signal trampoline that calls <code>handler(SIGUSR1)</code>. Ordinary work is paused.</p></div>
              <div class="trace-step"><span class="trace-number">5</span><strong>handler returns</strong><p>The trampoline invokes <code>rt_sigreturn</code>. The kernel restores the saved registers, and B resumes at the interrupted instruction.</p></div>
            </div>
            <figcaption class="terminal-caption">The handler is not a new thread. It temporarily borrows an existing thread’s execution context and usually its current stack.</figcaption>
          </div>
          <h2>Process-directed and thread-directed</h2>
          <p>Some signals target the process and may be delivered to any unblocked thread. Others target a specific thread, such as synchronous faults caused by that thread’s instruction or signals sent with <code>pthread_kill()</code>.</p>
          <p>Standard signals generally do not queue multiple identical instances. Real-time signals do queue and carry ordering guarantees. A signal mask is per-thread; the disposition is process-wide.</p>
          ${code("C · install with sigaction", `struct sigaction action = {0};
action.sa_sigaction = handler;
action.sa_flags = SA_SIGINFO | SA_ONSTACK;
sigemptyset(&action.sa_mask);
sigaction(SIGSEGV, &action, NULL);`)}
          ${callout("A handler interrupts arbitrary code", `Unless the signal is synchronously caused by the current instruction, assume the handler can run between any two machine instructions—including while libc holds an internal lock.`)}
        `,
        connections: ["signal-handlers", "async-signal-safety", "alternate-signal-stack", "stack-unwinding", "pthreads"],
        refs: [
          ["signal(7)", "https://man7.org/linux/man-pages/man7/signal.7.html"],
          ["sigaction(2)", "https://man7.org/linux/man-pages/man2/sigaction.2.html"]
        ]
      },
      {
        slug: "signal-handlers",
        title: "Signal handlers",
        question: "What is safe when normal execution is interrupted?",
        summary: "A handler runs on an interrupted thread with severe restrictions. Correct handlers preserve errno, avoid unsafe library state, and communicate through minimal mechanisms.",
        body: `
          <p>A <code>SA_SIGINFO</code> handler receives a <code>siginfo_t</code> and a platform context describing the interrupted machine state. That enables crash classification and register capture, but does not make ordinary library calls safe.</p>
          ${code("C · minimal pattern", `static void handler(int signo) {
    int saved_errno = errno;
    const char message[] = "signal\\n";
    write(STDERR_FILENO, message, sizeof message - 1);
    errno = saved_errno;
}`)}
          <h2>Reentrancy is the core problem</h2>
          <p>If a signal interrupts <code>malloc()</code> and the handler calls <code>malloc()</code> again, allocator state may be half-updated or locked. Similar hazards exist for stdio, dynamic loading, mutexes, logging, and most high-level code.</p>
          <p>Robust designs often copy fixed-size data into preallocated storage, write to a pipe/eventfd, or use raw async-signal-safe I/O, then let normal code perform expensive processing.</p>
          ${practiceNote(`Crash trackers and architecture-specific backtrace code operate in exactly this hostile context. Constructor state, alternate stacks, nesting, and async-signal safety are central design constraints.`)}
        `,
        connections: ["signals", "async-signal-safety", "alternate-signal-stack", "stack-unwinding", "syscalls"],
        refs: [["sigaction(2)", "https://man7.org/linux/man-pages/man2/sigaction.2.html"]]
      },
      {
        slug: "async-signal-safety",
        title: "Async-signal safety",
        question: "Why can a valid function be illegal inside a handler?",
        summary: "Async-signal-safe functions can be called when a signal interrupts arbitrary code. Thread-safe and reentrant are related but different properties.",
        body: `
          <p><strong>Thread-safe</strong> means concurrent normal calls cooperate. <strong>Reentrant</strong> code can be interrupted and entered again without corrupting shared state. <strong>Async-signal-safe</strong> is the POSIX guarantee for signal-handler use.</p>
          <div class="fact-grid">
            <div class="fact-card"><strong>Commonly safe</strong><p><code>write</code>, <code>_exit</code>, <code>kill</code>, selected memory and descriptor operations.</p></div>
            <div class="fact-card"><strong>Commonly unsafe</strong><p><code>malloc</code>, stdio, pthread mutexes, <code>dlopen</code>, most logging and formatting.</p></div>
          </div>
          ${callout("Check the actual standard list", `“It only reads memory” or “it usually works” is not a proof. Library implementation locks, lazy initialization, allocation, and TLS access can hide beneath a simple-looking API.`, "warning")}
          <p>The same restriction applies to the child after ${c("fork", "fork()")} in a multithreaded process until it calls an exec function.</p>
          ${practiceNote(`An immutable environment snapshot keeps raw <code>getenv()</code> out of signal-sensitive paths and prevents concurrent mutation from racing reads.`)}
        `,
        connections: ["signals", "signal-handlers", "fork", "syscalls", "environment"],
        refs: [["signal-safety(7)", "https://man7.org/linux/man-pages/man7/signal-safety.7.html"]]
      },
      {
        slug: "alternate-signal-stack",
        title: "Alternate signal stacks",
        question: "Where can a stack-overflow handler run?",
        summary: "sigaltstack provides per-thread emergency stack storage. SA_ONSTACK handlers use it when configured, including when the normal stack is exhausted or corrupted.",
        body: `
          <p>A handler normally runs on the interrupted thread’s current stack. That is unsuitable for handling stack overflow: there may be no usable space left. An alternate signal stack supplies a separate region.</p>
          ${code("C · per-thread setup", `stack_t stack = {
    .ss_sp = allocated_memory,
    .ss_size = allocated_size,
    .ss_flags = 0,
};
sigaltstack(&stack, NULL);

/* install handler with SA_ONSTACK */`)}
          <p>The alternate stack is configured per-thread. New threads do not automatically inherit an active alternate stack from another thread. Its memory must remain valid for as long as handlers may use it, and sizing must account for nested handlers and unwind/capture work.</p>
          ${callout("MINSIGSTKSZ is a floor, not a comfort rating", `Modern machine contexts, vector registers, sanitizers, and handler logic may require substantially more. Dynamic <code>SIGSTKSZ</code> behavior also exists on newer glibc configurations.`)}
        `,
        connections: ["stack", "signals", "signal-handlers", "stack-unwinding", "pthreads"],
        refs: [["sigaltstack(2)", "https://man7.org/linux/man-pages/man2/sigaltstack.2.html"]]
      },
      {
        slug: "stack-unwinding",
        title: "Stack unwinding",
        question: "How does a profiler reconstruct the call chain?",
        summary: "Unwinding walks from a machine context to caller frames using frame pointers, compiler-produced unwind metadata, or specialized heuristics.",
        body: `
          <p>A stack trace is not stored as a ready-made list. An unwinder starts with registers—especially instruction, stack, and sometimes frame pointers—and recovers the caller’s state repeatedly.</p>
          <h2>Two common strategies</h2>
          <ul>
            <li><strong>Frame pointers:</strong> simple linked frames when code preserves the architecture’s frame-pointer convention.</li>
            <li><strong>DWARF call-frame information:</strong> tables such as <code>.eh_frame</code> describe how to recover registers at instruction ranges.</li>
          </ul>
          <p>Optimizations complicate everything: inlining creates logical frames without physical calls, tail calls remove frames, and omitted frame pointers remove the simplest chain. Signal frames and runtime-managed stacks add specialized layouts.</p>
          ${callout("Crash-time unwinding is harder", `The stack or metadata may be corrupt, memory reads may fault, loader state may be changing, and general-purpose unwind libraries may not be async-signal-safe.`)}
          ${practiceNote(`Profilers commonly need separate AMD64 and ARM64 backtrace implementations plus language-runtime support, reflecting the difference between native and runtime-managed frames.`)}
        `,
        connections: ["abi", "calling-convention", "signal-handlers", "alternate-signal-stack", "trampolines"],
        refs: [
          ["DWARF standard", "https://dwarfstd.org/"],
          ["backtrace(3)", "https://man7.org/linux/man-pages/man3/backtrace.3.html"]
        ]
      }
    ]
  },
  {
    title: "Loading & Instrumentation",
    entries: [
      {
        slug: "dynamic-loader",
        title: "The dynamic loader",
        question: "Who maps shared libraries and resolves their symbols?",
        summary: "The ELF interpreter—commonly ld-linux—loads dependency graphs, applies dynamic relocations, establishes TLS, runs initializers, and transfers control to the program.",
        body: `
          <p>A dynamically linked executable names an interpreter in its <code>PT_INTERP</code> segment. The kernel maps that interpreter; the interpreter then reads <code>DT_NEEDED</code> entries, searches for objects, maps them, relocates them, and initializes them.</p>
          ${diagram(
            { text: "main executable" },
            { text: "DT_NEEDED graph" },
            { text: "ld-linux", accent: true },
            { text: "relocations + TLS" },
            { text: "initializers" }
          )}
          <div class="terminal-figure">
            <div class="terminal-titlebar"><span class="terminal-dots"><i></i><i></i><i></i></span>dependency walk · ./app</div>
            <div class="terminal-body">
              <div class="layer-stack">
                <div class="layer"><span class="layer-name">kernel</span><span class="layer-value">maps <code>./app</code> and its <code>PT_INTERP</code>: <code>/lib64/ld-linux-x86-64.so.2</code></span></div>
                <div class="layer"><span class="layer-name">app</span><span class="layer-value"><code>DT_NEEDED: libssl.so.3</code> · <code>DT_NEEDED: libc.so.6</code></span></div>
                <div class="layer"><span class="layer-name">libssl</span><span class="layer-value"><code>DT_NEEDED: libcrypto.so.3</code> · libc already discovered</span></div>
                <div class="layer"><span class="layer-name">loader</span><span class="layer-value">maps each unique object, builds lookup scopes, applies relocations, creates TLS, runs initializers</span></div>
                <div class="layer"><span class="layer-name">control</span><span class="layer-value">loader jumps to application entry code; startup code eventually calls <code>main</code></span></div>
              </div>
            </div>
            <figcaption class="terminal-caption">A <code>DT_NEEDED</code> entry stores a library name, not a complete path. The loader’s search rules turn each name into a file.</figcaption>
          </div>
          <h2>Search paths are contextual</h2>
          <p><code>RPATH</code>, <code>RUNPATH</code>, <code>LD_LIBRARY_PATH</code>, the loader cache, default directories, hardware capability directories, and secure-execution rules interact. Do not model lookup as merely “search <code>/usr/lib</code>.”</p>
          ${code("Shell · ask the loader", `readelf -lW ./program | grep INTERP
readelf -dW ./program
LD_DEBUG=libs,bindings ./program
/lib64/ld-linux-x86-64.so.2 --list ./program`)}
          ${callout("The loader has locks and reentrancy constraints", `Calling ${c("dlopen", "dlopen/dlsym")} from constructors, interposed loader functions, signal handlers, or fork handlers can deadlock or recurse. Loader-aware code must minimize assumptions.`)}
          ${practiceNote(`Loader compatibility layers handle differences across libc versions and route symbol lookup carefully to avoid interposition recursion.`)}
        `,
        connections: ["elf", "symbols", "relocations", "dlopen", "symbol-interposition", "thread-local-storage"],
        refs: [["ld.so(8)", "https://man7.org/linux/man-pages/man8/ld.so.8.html"]]
      },
      {
        slug: "dlopen",
        title: "dlopen, dlsym, and scopes",
        question: "How can a process load code after startup?",
        summary: "dlopen loads or references a shared object; dlsym resolves a symbol within a lookup scope; dlclose releases a reference but does not guarantee immediate unmapping.",
        body: `
          <p><code>dlopen()</code> accepts modes such as <code>RTLD_NOW</code> versus <code>RTLD_LAZY</code>, and <code>RTLD_LOCAL</code> versus <code>RTLD_GLOBAL</code>. These affect relocation timing and whether definitions become available to later lookups.</p>
          ${code("C · correct dlsym error handling", `dlerror(); /* clear old error */
void *address = dlsym(handle, "target_symbol");
const char *error = dlerror();
if (error != NULL) {
    /* lookup failed; a valid symbol value can be NULL */
}`)}
          <p>Special handles include <code>RTLD_DEFAULT</code>, which searches the normal global scope, and <code>RTLD_NEXT</code>, which searches after the current object—essential to many interposition wrappers.</p>
          <h2>Function pointers deserve care</h2>
          <p>POSIX specifies the practical <code>dlsym()</code> contract, while ISO C traditionally distinguishes object and function pointer conversions. Projects often isolate the conversion in a helper to satisfy strict warnings and make the assumption reviewable.</p>
          ${practiceNote(`Hooks resolve original library functions through guarded helpers, often using <code>RTLD_NEXT</code> or <code>RTLD_NOLOAD</code> to avoid loading unwanted objects.`)}
        `,
        connections: ["dynamic-loader", "symbols", "symbol-interposition", "elf", "abi"],
        refs: [
          ["dlopen(3)", "https://man7.org/linux/man-pages/man3/dlopen.3.html"],
          ["dlsym(3)", "https://man7.org/linux/man-pages/man3/dlsym.3.html"]
        ]
      },
      {
        slug: "symbol-interposition",
        title: "LD_PRELOAD and interposition",
        question: "How can one shared object stand in front of another?",
        summary: "LD_PRELOAD inserts shared objects early in the loader’s lookup scope, allowing exported definitions to intercept many dynamic symbol references.",
        body: `
          <p>When a call goes through dynamic symbol lookup, an earlier definition can win. A preload library exports the same symbol, performs instrumentation, and commonly finds the next definition with <code>dlsym(RTLD_NEXT, ...)</code>.</p>
          ${diagram(
            { text: "application calls SSL_read" },
            { text: "preload wrapper", accent: true },
            { text: "RTLD_NEXT lookup" },
            { text: "real SSL_read" }
          )}
          ${code("C · simplified wrapper", `ssize_t read(int fd, void *buffer, size_t count) {
    static ssize_t (*real_read)(int, void *, size_t);
    if (real_read == NULL) {
        /* resolve carefully; initialization must be thread-safe */
    }
    /* observe, call real_read, preserve API semantics */
}`)}
          <h2>What interposition does not catch</h2>
          <p>It may miss statically linked code, hidden or locally bound symbols, direct internal calls, inline functions, raw syscalls, alternate symbol versions, or references bound with options such as <code>-Bsymbolic</code>. Secure-execution mode restricts preloading.</p>
          ${callout("Hooks must preserve more than return values", `Correct wrappers preserve <code>errno</code>, cancellation behavior, calling convention, blocking semantics, recursion behavior, thread safety, and any library-specific ownership rules.`, "warning")}
          ${practiceNote(`An auto-instrumentation library may export wrappers for sockets, TLS, HTTP, and accelerator APIs. Its internal network client may use raw syscalls to avoid recursively triggering those hooks.`)}
        `,
        connections: ["dynamic-loader", "dlopen", "plt-got", "trampolines", "syscalls", "symbols"],
        refs: [
          ["ld.so(8): LD_PRELOAD", "https://man7.org/linux/man-pages/man8/ld.so.8.html"],
          ["dlsym(3): RTLD_NEXT", "https://man7.org/linux/man-pages/man3/dlsym.3.html"]
        ]
      },
      {
        slug: "plt-got",
        title: "PLT and GOT",
        question: "How does position-independent code call an unknown address?",
        summary: "The Global Offset Table holds resolved addresses and the Procedure Linkage Table supplies call stubs. Together they enable dynamic calls without embedding fixed target addresses.",
        body: `
          <p>Let’s follow one real-looking x86-64 call to <code>puts()</code>. The exact addresses vary in every binary, but the instructions and state changes below are representative of a lazily bound ELF executable.</p>
          <div class="timeline-demo" data-timeline="plt"></div>

          ${callout("PLT code versus GOT data", `The PLT does not have one mutable pointer value. It is machine code stored around <code>0x401030</code> in an executable R-X mapping. Its “value” is its instruction bytes. The GOT slot is separate data at <code>0x404000</code>; those eight bytes store one pointer and are what the loader edits.`)}
          <div class="system-lab" data-lab="plt-resolver"></div>

          <h2>The three pieces</h2>
          <div class="terminal-figure">
            <div class="terminal-titlebar"><span class="terminal-dots"><i></i><i></i><i></i></span>process image · three different locations</div>
            <div class="terminal-body">
              <div class="layer-stack">
                <div class="layer"><span class="layer-name">caller .text</span><span class="layer-value"><code>0x401146: call 0x401030 &lt;puts@plt&gt;</code></span></div>
                <div class="layer"><span class="layer-name">PLT code</span><span class="layer-value"><code>0x401030: jmp *0x2fca(%rip)</code></span></div>
                <div class="layer"><span class="layer-name">GOT data</span><span class="layer-value"><code>0x404000: 0x0000000000401036</code> — one writable address-sized slot</span></div>
              </div>
            </div>
            <figcaption class="terminal-caption">PLT = executable instructions. GOT = data containing addresses. The caller knows the PLT address, but does not yet know the address of <code>puts</code> inside libc.</figcaption>
          </div>

          <h2>First call, one instruction at a time</h2>
          <div class="terminal-figure">
            <div class="terminal-titlebar"><span class="terminal-dots"><i></i><i></i><i></i></span>objdump -d ./hello · simplified</div>
            <div class="terminal-body">
              <div class="asm-grid">
                <div class="asm-line active"><span class="asm-address">0x401146</span><span class="asm-op">call</span><span class="asm-target">0x401030 &lt;puts@plt&gt;</span><span class="asm-comment">push 0x40114b; go to PLT</span></div>
                <div class="asm-line"><span class="asm-address">0x401030</span><span class="asm-op">jmp</span><span class="asm-target">*0x2fca(%rip)</span><span class="asm-comment">read pointer at 0x404000; go there</span></div>
                <div class="asm-line"><span class="asm-address">0x401036</span><span class="asm-op">push</span><span class="asm-target">$0x0</span><span class="asm-comment">identify relocation slot 0</span></div>
                <div class="asm-line"><span class="asm-address">0x40103b</span><span class="asm-op">jmp</span><span class="asm-target">0x401020 &lt;plt0&gt;</span><span class="asm-comment">enter dynamic-loader resolver</span></div>
              </div>
            </div>
            <figcaption class="terminal-caption"><code>call</code> saves a return address. <code>jmp</code> does not; it only changes the instruction pointer. The first GOT value is <code>0x401036</code>, sending execution back into the second PLT instruction.</figcaption>
          </div>

          <div class="terminal-figure">
            <div class="terminal-titlebar"><span class="terminal-dots"><i></i><i></i><i></i></span>CPU trace · first puts call</div>
            <div class="step-trace">
              <div class="trace-step"><span class="trace-number">1</span><strong><code>call puts@plt</code></strong><p>CPU pushes the next instruction address, <code>0x40114b</code>, onto the stack. Then <code>RIP = 0x401030</code>.</p></div>
              <div class="trace-step"><span class="trace-number">2</span><strong><code>jmp *disp(%rip)</code></strong><p>The CPU adds displacement <code>0x2fca</code> to RIP after the jump instruction: <code>0x401036 + 0x2fca = 0x404000</code>. It reads eight bytes from that GOT address.</p></div>
              <div class="trace-step"><span class="trace-number">3</span><strong>GOT says <code>0x401036</code></strong><p>This is the first call, so the slot points back into the PLT. CPU sets <code>RIP = 0x401036</code>, pushes relocation index <code>0</code>, and jumps through PLT0.</p></div>
              <div class="trace-step"><span class="trace-number">4</span><strong>loader resolves <code>puts</code></strong><p>The resolver reads the relocation and symbol tables, searches loaded objects, and finds libc’s <code>puts</code> at example address <code>0x7ffff7e41980</code>.</p></div>
              <div class="trace-step"><span class="trace-number">5</span><strong>loader patches GOT</strong><p>It writes <code>0x7ffff7e41980</code> into address <code>0x404000</code>, then transfers control to that address. <code>puts</code> eventually returns to saved address <code>0x40114b</code>.</p></div>
            </div>
          </div>

          <h2>What changed in memory?</h2>
          <div class="terminal-figure">
            <div class="terminal-titlebar"><span class="terminal-dots"><i></i><i></i><i></i></span>GOT slot at virtual address 0x404000</div>
            <div class="state-split">
              <section class="state-panel">
                <h3>Before first call</h3>
                <div class="state-row"><span class="state-key">stored value</span><span class="state-value">0x0000000000401036</span></div>
                <div class="state-row"><span class="state-key">points to</span><span class="state-value">puts@plt + 6</span></div>
                <div class="state-row"><span class="state-key">meaning</span><span class="state-value">please resolve me</span></div>
              </section>
              <section class="state-panel">
                <h3>After resolver runs</h3>
                <div class="state-row"><span class="state-key">stored value</span><span class="state-value changed">0x00007ffff7e41980</span></div>
                <div class="state-row"><span class="state-key">points to</span><span class="state-value changed">libc puts</span></div>
                <div class="state-row"><span class="state-key">meaning</span><span class="state-value changed">jump directly here</span></div>
              </section>
            </div>
            <figcaption class="terminal-caption">The GOT slot is eight bytes on x86-64 because it stores one 64-bit virtual address. The code did not change; only this data slot changed.</figcaption>
          </div>

          <h2>Second call: the short path</h2>
          ${diagram(
            { text: "call puts@PLT" },
            { text: "jmp *GOT[puts]" },
            { text: "GOT contains libc address", accent: true },
            { text: "puts executes" }
          )}
          <p>The same <code>call</code> and PLT <code>jmp</code> execute again. This time the GOT read produces the real libc address, so the resolver path disappears. With immediate binding, the loader fills this slot during startup instead.</p>

          <h2>Lazy versus immediate binding</h2>
          <p>Lazy binding postpones function resolution until first use. <code>RTLD_NOW</code> or <code>LD_BIND_NOW</code> resolves eagerly. RELRO can make relocation regions read-only after startup; full RELRO combined with eager binding hardens GOT slots against later writes.</p>
          ${callout("Read the asterisk literally", `<code>jmp 0x404000</code> would jump <em>to</em> address <code>0x404000</code>. <code>jmp *0x2fca(%rip)</code> first reads an address from memory, then jumps to the address it read. That extra memory lookup is the indirection.`)}
          <p>Not every architecture or toolchain emits identical sequences, and optimized code may bypass the PLT. The concrete trace above is the classic x86-64 lazy-binding shape; inspect the produced binary to see its actual form.</p>
          ${code("Shell · make indirection visible", `objdump -d --disassemble=foo@plt ./program
readelf -rW ./program
readelf -dW ./program | grep -E 'BIND_NOW|FLAGS'`)}
        `,
        connections: ["relocations", "dynamic-loader", "symbol-interposition", "trampolines", "elf"],
        refs: [["ELF dynamic linking", "https://refspecs.linuxfoundation.org/elf/gabi4+/ch5.dynamic.html"]]
      },
      {
        slug: "trampolines",
        title: "Hooks and trampolines",
        question: "How can instrumentation redirect code without symbol lookup?",
        summary: "An inline hook overwrites initial instructions with a branch. A trampoline preserves displaced instructions and returns execution to the original function body.",
        body: `
          <p>Symbol interposition changes lookup. Inline hooking changes already-resolved machine code. The hook engine decodes enough instructions to install a jump, copies displaced instructions into executable storage, fixes any position-dependent encoding, and jumps back.</p>
          ${diagram(
            { text: "original entry" },
            { text: "jump to hook", accent: true },
            { text: "instrumentation" },
            { text: "trampoline: displaced bytes + jump back" }
          )}
          <h2>Why instruction relocation is difficult</h2>
          <ul>
            <li>Instructions have variable sizes on x86-64.</li>
            <li>PC-relative branches and data references change meaning when copied.</li>
            <li>AArch64 branches have fixed encoding and limited ranges.</li>
            <li>Other threads may execute the code while it is being patched.</li>
            <li>Instruction caches and memory permissions require architecture-specific handling.</li>
          </ul>
          ${callout("The ABI still rules", `The hook and trampoline must preserve registers, stack alignment, return conventions, and special runtime state exactly as the replaced function expects.`, "warning")}
          ${practiceNote(`A portable hook engine can own allocation and patching while separate AMD64 and ARM64 assembly files implement architecture-specific entry mechanics.`)}
        `,
        connections: ["calling-convention", "abi", "mmap", "plt-got", "symbol-interposition", "stack-unwinding"],
        refs: [["mprotect(2)", "https://man7.org/linux/man-pages/man2/mprotect.2.html"]]
      },
      {
        slug: "calling-convention",
        title: "Calling conventions",
        question: "What must remain true across every function call?",
        summary: "Calling conventions define argument locations, return values, preserved registers, stack alignment, variadic behavior, and special state required at binary boundaries.",
        body: `
          <p>The caller and callee divide responsibility. Caller-saved registers may be overwritten by the call. Callee-saved registers must be restored before return. The stack pointer must meet an alignment rule at specified points.</p>
          <h2>Why low-level boundaries expose mistakes</h2>
          <p>Ordinary compiled calls automatically obey the convention. Hand-written assembly, generated trampolines, callbacks cast to the wrong type, and variadic forwarding can violate it. Symptoms may appear far away: corrupted registers, crashes only with vector instructions, or broken unwinding.</p>
          ${code("C · type is part of the protocol", `typedef int (*operation_fn)(void *context, size_t size);

/* Calling an address through an incompatible function-pointer type
   is undefined behavior even if the symbol name is correct. */`)}
          <p>Stack unwinding conventions and exception metadata are adjacent contracts. A trampoline invisible to the unwinder can truncate or corrupt backtraces even if it executes correctly.</p>
          ${practiceNote(`Architecture-specific assembly saves host state before entering common C hook logic. This boundary deserves instruction-level tests on every supported architecture.`)}
        `,
        connections: ["abi", "trampolines", "stack", "stack-unwinding", "symbols"],
        refs: [
          ["System V AMD64 ABI", "https://gitlab.com/x86-psABIs/x86-64-ABI"],
          ["AAPCS64", "https://github.com/ARM-software/abi-aa/blob/main/aapcs64/aapcs64.rst"]
        ]
      }
    ]
  },
  {
    title: "Kernel Boundary & Portability",
    entries: [
      {
        slug: "syscalls",
        title: "System calls",
        question: "When does userspace actually enter the kernel?",
        summary: "A syscall is an architecture-defined transition into a kernel service. libc normally wraps it, translating calling conventions, cancellation rules, and errors.",
        body: `
          <p>A C call such as <code>read()</code> is usually a libc function. Its implementation arranges the kernel syscall number and arguments, executes the architecture’s transition instruction, and converts a negative kernel result into <code>-1</code> plus <code>errno</code>.</p>
          <div class="timeline-demo" data-timeline="syscall"></div>
          ${diagram(
            { text: "C API call" },
            { text: "libc wrapper" },
            { text: "syscall ABI", accent: true },
            { text: "kernel implementation" }
          )}
          <div class="terminal-figure">
            <div class="terminal-titlebar"><span class="terminal-dots"><i></i><i></i><i></i></span>x86-64 · read(3, buffer, 100)</div>
            <div class="step-trace">
              <div class="trace-step"><span class="trace-number">1</span><strong>C calls libc</strong><p>Normal function-call ABI places <code>fd=3</code> in RDI, <code>buffer</code> in RSI, and <code>count=100</code> in RDX.</p></div>
              <div class="trace-step"><span class="trace-number">2</span><strong>wrapper selects syscall</strong><p>libc places <code>SYS_read = 0</code> in RAX. Argument registers already match the first three Linux syscall arguments.</p></div>
              <div class="trace-step"><span class="trace-number">3</span><strong><code>syscall</code></strong><p>The CPU saves the userspace return RIP in RCX, saves flags in R11, switches privilege level and kernel stack, then enters the configured kernel syscall entry point.</p></div>
              <div class="trace-step"><span class="trace-number">4</span><strong>kernel executes read</strong><p>The kernel validates userspace buffer <code>RSI</code>, looks up descriptor slot <code>RDI = 3</code>, and invokes that open file’s read operation.</p></div>
              <div class="trace-step"><span class="trace-number">5</span><strong>return in RAX</strong><p>Example success: <code>RAX = 37</code> bytes. Example kernel error: <code>RAX = -9</code> for <code>EBADF</code>.</p></div>
              <div class="trace-step"><span class="trace-number">6</span><strong>libc translates error</strong><p>For <code>-9</code>, libc writes <code>errno = 9</code> in thread-local storage and returns <code>-1</code> to C. For success, it returns 37 unchanged.</p></div>
            </div>
          </div>
          <div class="terminal-figure">
            <div class="terminal-titlebar"><span class="terminal-dots"><i></i><i></i><i></i></span>register snapshot immediately before syscall</div>
            <div class="terminal-body">
              <div class="memory-table">
                <div class="memory-row header"><span class="memory-cell">register</span><span class="memory-cell">value</span><span class="memory-cell">meaning</span></div>
                <div class="memory-row"><span class="memory-cell">RAX</span><span class="memory-cell">0</span><span class="memory-cell">syscall number: read</span></div>
                <div class="memory-row"><span class="memory-cell">RDI</span><span class="memory-cell">3</span><span class="memory-cell">argument 1: file descriptor</span></div>
                <div class="memory-row"><span class="memory-cell">RSI</span><span class="memory-cell">0x7fff…e900</span><span class="memory-cell">argument 2: userspace destination address</span></div>
                <div class="memory-row"><span class="memory-cell">RDX</span><span class="memory-cell">100</span><span class="memory-cell">argument 3: maximum byte count</span></div>
              </div>
            </div>
            <figcaption class="terminal-caption">This is the Linux x86-64 syscall ABI. AArch64 and other architectures use different registers and transition instructions.</figcaption>
          </div>
          <h2>Why bypass libc?</h2>
          <p>Raw syscalls can avoid symbol interposition or reduce dependencies in a signal-sensitive path. But they also bypass portability, pthread cancellation integration, time64 adaptation, restart behavior, and libc compatibility logic.</p>
          ${callout("A raw syscall is a sharp platform contract", `Syscall numbers, argument registers, availability, and structures vary by architecture and kernel. Prefer libc unless bypassing it solves a concrete problem and the platform surface is deliberately contained.`, "warning")}
          <h2>The vDSO exception</h2>
          <p>Some kernel-provided operations such as clock queries may execute through a small ELF object mapped into userspace, avoiding a full privilege transition while retaining a kernel-defined interface.</p>
          ${practiceNote(`Injected networking code may use direct syscalls where ordinary socket APIs could recurse through the library’s own <code>LD_PRELOAD</code> hooks.`)}
        `,
        connections: ["symbol-interposition", "abi", "file-descriptors", "async-signal-safety", "libc"],
        refs: [
          ["syscall(2)", "https://man7.org/linux/man-pages/man2/syscall.2.html"],
          ["vdso(7)", "https://man7.org/linux/man-pages/man7/vdso.7.html"]
        ]
      },
      {
        slug: "libc",
        title: "glibc, musl, and libc",
        question: "Is libc just a bag of syscall wrappers?",
        summary: "libc implements the C and POSIX interfaces, runtime startup, allocation, threads, dynamic loading integration, DNS, locale, and much more. Implementations expose different internals and tradeoffs.",
        body: `
          <p>Linux is the kernel, not the complete application platform. libc supplies headers, ABI-facing functions, startup objects, the pthread implementation, allocator, resolver, stdio, environment handling, and often the dynamic loader.</p>
          <h2>glibc and musl are compatible—not identical</h2>
          <p>They target compatible source and binary interfaces where applicable, but differ in loader internals, symbol versioning, TLS allocation, DNS behavior, extension APIs, static-linking characteristics, and undocumented private symbols.</p>
          ${callout("Private libc symbols are not stable API", `Names beginning with internal conventions such as <code>__libc_*</code> may solve a narrow compatibility problem but can disappear or behave differently. Isolate them behind feature detection and fallbacks.`, "warning")}
          <p>Since glibc 2.34, several historically separate libraries—including much of libpthread and libdl—were integrated into libc, while compatibility shared objects remain for existing binaries. Build-time and runtime version distinctions still matter.</p>
          ${practiceNote(`Portable instrumentation deliberately navigates libc-version and interposition constraints. Test matrices should include glibc and musl because loader and TLS behavior differ materially.`)}
        `,
        connections: ["syscalls", "dynamic-loader", "pthreads", "thread-local-storage", "abi"],
        refs: [
          ["GNU C Library manual", "https://www.gnu.org/software/libc/manual/"],
          ["musl functional differences", "https://wiki.musl-libc.org/functional-differences-from-glibc.html"]
        ]
      },
      {
        slug: "errno",
        title: "errno and error contracts",
        question: "Why can successful code leave errno nonzero?",
        summary: "errno is thread-local error detail whose value is meaningful only when an API reports failure according to its own contract.",
        body: `
          <p>Many libc wrappers set <code>errno</code> after failure. They generally do not clear it before success, so reading it without first observing the documented failure return is a bug.</p>
          ${code("C · interpret the return first", `ssize_t count = read(fd, buffer, size);
if (count == -1) {
    int error = errno;
    /* handle error */
}`)}
          <p>Some functions return error numbers directly—many pthread APIs do this. Others use sentinel values that can also be valid, requiring the caller to clear <code>errno</code> first. <code>dlsym()</code> has its own <code>dlerror()</code> protocol.</p>
          <h2>Hooks must preserve errno</h2>
          <p>Instrumentation performed after calling a real function may itself change <code>errno</code>. A transparent wrapper captures it immediately, does its work, and restores it before returning whenever the wrapped API’s semantics require that.</p>
          ${practiceNote(`Interposed functions execute extra instrumentation around host calls. Preserving error contracts is essential because callers may inspect <code>errno</code> immediately.`)}
        `,
        connections: ["pthreads", "symbol-interposition", "syscalls", "dlopen", "thread-local-storage"],
        refs: [["errno(3)", "https://man7.org/linux/man-pages/man3/errno.3.html"]]
      },
      {
        slug: "undefined-behavior",
        title: "Undefined behavior",
        question: "Why can a bug disappear when logging is added?",
        summary: "Undefined behavior removes language constraints from an execution. Optimizers may transform code based on the assumption that UB never happens.",
        body: `
          <p>Common systems-level UB includes signed integer overflow, out-of-bounds access, use after lifetime, invalid shifts, data races, misaligned access, incompatible function-pointer calls, and violating effective-type or aliasing rules.</p>
          <h2>UB is not a predictable fallback</h2>
          <p>“It works on this compiler” describes an observation, not a contract. Optimization can propagate assumptions far from the original mistake. Timing and layout changes from logging often hide races or invalid memory use.</p>
          <div class="fact-grid">
            <div class="fact-card"><strong>ASan</strong><p>Out-of-bounds, use-after-free, and related memory errors.</p></div>
            <div class="fact-card"><strong>UBSan</strong><p>Many invalid language operations and conversions.</p></div>
            <div class="fact-card"><strong>TSan</strong><p>Data races and synchronization mistakes.</p></div>
            <div class="fact-card"><strong>Compiler warnings</strong><p>Type, lifetime, format, conversion, and control-flow risks.</p></div>
          </div>
          ${callout("Instrumentation changes the host", `Preload and inline-hook code operates inside programs built with different compilers, sanitizers, allocators, and runtimes. Avoid relying on accidental layout, private state, or unproven aliasing assumptions.`, "warning")}
        `,
        connections: ["c-language", "c-memory-model", "atomics", "calling-convention", "abi"],
        refs: [
          ["Clang sanitizers", "https://clang.llvm.org/docs/index.html#sanitizers"],
          ["GCC warning options", "https://gcc.gnu.org/onlinedocs/gcc/Warning-Options.html"]
        ]
      },
      {
        slug: "debugging-toolbox",
        title: "The debugging toolbox",
        question: "Which tool answers which layer?",
        summary: "Use source tools for declarations, ELF tools for binary structure, tracing tools for runtime boundaries, and debuggers for live machine state.",
        body: `
          <div class="fact-grid">
            <div class="fact-card"><strong><code>readelf</code> / <code>nm</code></strong><p>ELF headers, symbols, relocations, dynamic metadata, notes.</p></div>
            <div class="fact-card"><strong><code>objdump</code></strong><p>Disassembly connected to symbols and relocations.</p></div>
            <div class="fact-card"><strong><code>strace</code></strong><p>Syscalls, signals, file descriptors, process creation.</p></div>
            <div class="fact-card"><strong><code>gdb</code></strong><p>Registers, mappings, frames, memory, breakpoints, loaded objects.</p></div>
            <div class="fact-card"><strong><code>perf</code></strong><p>Sampling, hardware counters, scheduling, hotspots.</p></div>
            <div class="fact-card"><strong><code>LD_DEBUG</code></strong><p>Dynamic-loader searches, relocation, versions, and bindings.</p></div>
          </div>
          ${code("Shell · a layered first pass", `file ./program
readelf -hldWs ./program
LD_DEBUG=libs,bindings ./program 2>loader.log
strace -ff -o syscalls ./program
gdb --args ./program`)}
          <h2>Build a hypothesis before adding tools</h2>
          <p>If a symbol resolves incorrectly, inspect ELF and loader bindings. If a wrapper recurses, trace calls and syscalls. If a child hangs after fork, inspect thread stacks and locks. If behavior changes with optimization, run sanitizers and examine generated assembly.</p>
          ${callout("Observe the same artifact you ship", `Debug and release builds may differ in optimization, symbol visibility, frame pointers, PIE, RELRO, and stripping. Reproduce against the actual build configuration whenever possible.`)}
        `,
        connections: ["elf", "dynamic-loader", "syscalls", "stack-unwinding", "undefined-behavior", "procfs"],
        refs: [
          ["strace", "https://strace.io/"],
          ["GDB documentation", "https://sourceware.org/gdb/documentation/"],
          ["perf wiki", "https://perf.wiki.kernel.org/"]
        ]
      }
    ]
  }
];

const timelineDefinitions = {};

function pltMachineState({ rip, rsp, stack, got, loader = "idle", changed = [] }) {
  const isChanged = (name) => changed.includes(name);
  return [
    ["RIP", rip, isChanged("rip"), "CPU REGISTERS"],
    ["RSP", rsp, isChanged("rsp"), "CPU REGISTERS"],
    ["entry address", "0x401030", false, "CODE MEMORY · .plt · R-X"],
    ["16 code bytes", "ff 25 ca 2f 00 00 · 68 00 00 00 00 · e9 e0 ff ff ff", isChanged("plt"), "CODE MEMORY · .plt · R-X"],
    ["stack top", stack, isChanged("stack"), "STACK MEMORY · RW"],
    ["slot address", "0x404000", isChanged("gotAddress"), "DATA MEMORY · .got.plt · RW BEFORE RELRO"],
    ["8-byte value", got, isChanged("got"), "DATA MEMORY · .got.plt · RW BEFORE RELRO"],
    ["lookup", loader, isChanged("loader"), "DYNAMIC LOADER STATE"]
  ];
}

timelineDefinitions.plt = {
  title: "LIVE TRACE · LAZY PLT/GOT RESOLUTION",
  programLabel: "x86-64 instructions / loader actions",
  stateLabel: "CPU + code memory + data memory + loader",
  path: ["caller", "PLT", "GOT", "loader", "libc", "caller"],
  lines: [
    ["0x401146", "call 0x401030 &lt;puts@plt&gt;"],
    ["0x401030", "jmp *0x2fca(%rip)"],
    ["0x401036", "push $0x0"],
    ["0x40103b", "jmp 0x401020 &lt;plt0&gt;"],
    ["ld.so", "resolve(symbol = puts)"],
    ["ld.so", "GOT[puts] = 0x7ffff7e41980"],
    ["0x7ffff7e41980", "puts(...)"],
    ["0x40114b", "next caller instruction"]
  ],
  frames: [
    { active: 0, path: 0, title: "About to call", text: "RIP points at call. The GOT data slot still contains a pointer back into the PLT code.", state: pltMachineState({ rip: "0x401146 · caller code", rsp: "0x7fff…fee8", stack: "caller data", got: "0x401036 → PLT+6" }) },
    { active: 1, path: 1, title: "call transfers control", text: "call pushes its return address, then sets RIP to the PLT code address 0x401030.", state: pltMachineState({ rip: "0x401030 · PLT code", rsp: "0x7fff…fee0", stack: "0x40114b · return address", got: "0x401036 → PLT+6", changed: ["rip", "rsp", "stack", "plt"] }) },
    { active: 2, path: 2, title: "indirect jump reads GOT data", text: "The PLT instruction reads the eight-byte data slot at 0x404000. Its stored pointer is 0x401036, so RIP goes there.", state: pltMachineState({ rip: "0x401036 · PLT+6 code", rsp: "0x7fff…fee0", stack: "0x40114b · return address", got: "0x401036 → PLT+6", changed: ["rip", "gotAddress", "got"] }) },
    { active: 3, path: 1, title: "identify the relocation", text: "PLT code pushes relocation index 0 onto stack memory, then enters PLT0.", state: pltMachineState({ rip: "0x40103b · PLT code", rsp: "0x7fff…fed8", stack: "relocation #0", got: "0x401036 → PLT+6", changed: ["rip", "rsp", "stack", "plt"] }) },
    { active: 4, path: 3, title: "loader searches symbols", text: "The resolver follows relocation #0 to the name puts, then searches loaded objects. The PLT code and GOT data have not changed yet.", state: pltMachineState({ rip: "ld.so resolver code", rsp: "0x7fff…fed8", stack: "relocation #0", got: "0x401036 → PLT+6", loader: "puts → found in libc.so.6", changed: ["rip", "loader"] }) },
    { active: 5, path: 3, title: "the GOT data mutation", text: "The loader writes a new eight-byte pointer into data address 0x404000. PLT machine-code bytes remain unchanged.", state: pltMachineState({ rip: "ld.so resolver code", rsp: "0x7fff…fed8", stack: "relocation #0", got: "0x7ffff7e41980 → libc puts", loader: "resolved · patch complete", changed: ["gotAddress", "got", "loader"] }) },
    { active: 6, path: 4, title: "real puts runs", text: "The loader transfers control to the address now stored in the GOT. The CPU is executing libc code, not PLT code.", state: pltMachineState({ rip: "0x7ffff7e41980 · libc code", rsp: "0x7fff…fed8", stack: "0x40114b · return address", got: "0x7ffff7e41980 → libc puts", loader: "idle", changed: ["rip"] }) },
    { active: 7, path: 5, title: "return to the caller", text: "puts returns to the saved caller address. On the next call, PLT code reads the already-patched GOT data and jumps straight to libc.", state: pltMachineState({ rip: "0x40114b · caller code", rsp: "0x7fff…fee8", stack: "caller data", got: "0x7ffff7e41980 → libc puts", loader: "idle", changed: ["rip", "rsp", "stack"] }) }
  ]
};

timelineDefinitions.fd = {
  title: "LIVE STATE · FILE DESCRIPTOR LIFETIME",
  programLabel: "C operations",
  stateLabel: "userspace handles + kernel open state",
  path: ["C integer", "fd table", "struct file", "file bytes"],
  lines: [
    ["1", "fd3 = open(\"notes.txt\", O_RDONLY)"],
    ["2", "fd4 = dup(fd3)"],
    ["3", "read(fd3, buffer, 100)"],
    ["4", "read(fd4, buffer, 20)"],
    ["5", "close(fd3)"],
    ["6", "close(fd4)"]
  ],
  frames: [
    { active: 0, path: 0, title: "before open", text: "The variables do not yet hold usable descriptors, and there is no open file description.", state: [["fd3", "uninitialized"], ["fd4", "uninitialized"], ["refcount", "0"], ["file offset", "—"]] },
    { active: 0, path: 2, title: "open creates state", text: "The kernel creates open description A, puts a pointer to A in slot 3, and returns integer 3.", state: [["fd3", "3 → table[3] → A", true], ["fd4", "uninitialized"], ["refcount A", "1", true], ["offset A", "0", true]] },
    { active: 1, path: 2, title: "dup copies the pointer", text: "Slot 4 receives another pointer to A. It does not create a second independent file position.", state: [["fd3", "3 → A"], ["fd4", "4 → A", true], ["refcount A", "2", true], ["offset A", "0"]] },
    { active: 2, path: 3, title: "read through fd 3", text: "The kernel reads bytes 0–99 and edits the offset stored in shared description A.", state: [["fd3", "3 → A"], ["fd4", "4 → A"], ["bytes returned", "100", true], ["offset A", "100", true]] },
    { active: 3, path: 3, title: "fd 4 observes shared offset", text: "Because fd 4 points to the same A, its read begins at byte 100 and advances A to 120.", state: [["fd3", "3 → A"], ["fd4", "4 → A"], ["bytes returned", "20", true], ["offset A", "120", true]] },
    { active: 4, path: 1, title: "close removes one slot", text: "Slot 3 becomes empty. A remains alive because slot 4 still holds a reference.", state: [["fd3", "3 → empty", true], ["fd4", "4 → A"], ["refcount A", "1", true], ["offset A", "120"]] },
    { active: 5, path: 1, title: "last close releases A", text: "Slot 4 becomes empty. The reference count reaches zero, so the kernel can destroy A.", state: [["fd3", "3 → empty"], ["fd4", "4 → empty", true], ["refcount A", "0", true], ["open state", "destroyed", true]] }
  ]
};

timelineDefinitions.syscall = {
  title: "LIVE TRACE · READ SYSCALL",
  programLabel: "x86-64 boundary crossing",
  stateLabel: "registers + privilege + error state",
  path: ["C caller", "libc", "CPU gate", "kernel", "libc", "C caller"],
  lines: [
    ["user", "read(3, buffer, 100)"],
    ["libc", "mov $0, %rax        # SYS_read"],
    ["libc", "syscall"],
    ["kernel", "fdget(3) → file operation"],
    ["kernel", "return -9          # -EBADF"],
    ["libc", "errno = 9; return -1"],
    ["user", "if (result == -1) ..."]
  ],
  frames: [
    { active: 0, path: 0, title: "ordinary function call", text: "The C ABI puts the three arguments into RDI, RSI, and RDX before entering libc.", state: [["RDI", "3 · fd"], ["RSI", "0x7fff…e900 · buffer"], ["RDX", "100 · count"], ["privilege", "userspace"]] },
    { active: 1, path: 1, title: "select the kernel operation", text: "The wrapper writes syscall number 0, meaning read on Linux x86-64, into RAX.", state: [["RAX", "0 · SYS_read", true], ["RDI", "3"], ["RSI", "0x7fff…e900"], ["RDX", "100"]] },
    { active: 2, path: 2, title: "execute syscall", text: "The CPU saves the userspace return location, switches stacks and privilege, and jumps to the kernel entry point.", state: [["RIP", "kernel entry", true], ["RCX", "saved user RIP", true], ["R11", "saved user flags", true], ["privilege", "kernel", true]] },
    { active: 3, path: 3, title: "kernel follows fd 3", text: "The kernel uses integer 3 to look up the descriptor slot. In this example the slot is invalid.", state: [["syscall", "read"], ["fd", "3"], ["fd table[3]", "empty", true], ["result RAX", "pending"]] },
    { active: 4, path: 3, title: "kernel returns a negative error", text: "The kernel ABI returns -EBADF directly in RAX. It does not write the userspace errno variable.", state: [["RAX", "-9", true], ["meaning", "EBADF"], ["privilege", "returning to user"], ["errno", "unchanged"]] },
    { active: 5, path: 4, title: "libc translates conventions", text: "The wrapper recognizes the negative kernel result, stores positive 9 in thread-local errno, and chooses C return value -1.", state: [["kernel result", "-9"], ["errno", "9 · EBADF", true], ["C return", "-1", true], ["privilege", "userspace"]] },
    { active: 6, path: 5, title: "caller handles failure", text: "The C program first sees return value -1; only then is errno meaningful for this call.", state: [["result", "-1"], ["errno", "9 · EBADF"], ["RIP", "caller error branch", true], ["privilege", "userspace"]] }
  ]
};

const entries = groups.flatMap((group) => group.entries.map((entry) => ({ ...entry, group: group.title })));
const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));
const storage = {
  get(key, fallback = null) {
    try {
      return window.localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Some browsers restrict storage for file:// pages; the guide still works in memory.
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // See set().
    }
  }
};
function storedArray(key) {
  try {
    const value = JSON.parse(storage.get(key, "[]"));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
const state = {
  current: "readme",
  read: new Set(storedArray("linux-field-guide-read")),
  collapsed: new Set(storedArray("linux-field-guide-collapsed"))
};

const article = document.getElementById("article");
const toc = document.getElementById("toc");
const search = document.getElementById("search");
const progressLabel = document.getElementById("progress-label");
const progressBar = document.getElementById("progress-bar");

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[character]);
}

let timelineCleanups = [];

function disposeTimelines() {
  timelineCleanups.forEach((cleanup) => cleanup());
  timelineCleanups = [];
}

function timelineMarkup(definition) {
  return `
    <section class="timeline-player" aria-label="${escapeHtml(definition.title)}">
      <div class="terminal-titlebar">
        <span class="terminal-dots"><i></i><i></i><i></i></span>
        ${escapeHtml(definition.title)} · 1 STEP / SECOND
      </div>
      <div class="timeline-stage">
        <div class="timeline-program">
          <span class="timeline-panel-label">${escapeHtml(definition.programLabel)}</span>
          <div class="timeline-code">
            ${definition.lines.map(([address, instruction], index) => `
              <div class="timeline-line" data-line="${index}">
                <span class="timeline-pc" aria-hidden="true">▶</span>
                <span class="timeline-address">${escapeHtml(address)}</span>
                <span class="timeline-instruction">${instruction}</span>
              </div>`).join("")}
          </div>
          <div class="timeline-path" aria-label="Control flow">
            ${definition.path.map((node, index) => `${index ? '<span class="timeline-path-edge"></span>' : ""}<span class="timeline-path-node" data-path="${index}">${escapeHtml(node)}</span>`).join("")}
          </div>
        </div>
        <div class="timeline-state">
          <span class="timeline-panel-label">${escapeHtml(definition.stateLabel || "live state")}</span>
          <div class="timeline-state-grid"></div>
          <div class="timeline-explanation"></div>
          <span class="timeline-live" aria-live="polite"></span>
        </div>
      </div>
      <div class="timeline-controls">
        <div class="timeline-buttons">
          <button class="timeline-button timeline-prev" type="button" aria-label="Previous step">←</button>
          <button class="timeline-button timeline-play" type="button" aria-label="Pause animation">❚❚</button>
          <button class="timeline-button timeline-next" type="button" aria-label="Next step">→</button>
        </div>
        <input class="timeline-range" type="range" min="0" max="${definition.frames.length - 1}" value="0" step="1" aria-label="Animation timeline" />
        <span class="timeline-counter"></span>
      </div>
    </section>`;
}

function mountTimeline(host, definition) {
  host.innerHTML = timelineMarkup(definition);
  const player = host.querySelector(".timeline-player");
  const lines = [...player.querySelectorAll(".timeline-line")];
  const pathNodes = [...player.querySelectorAll(".timeline-path-node")];
  const pathEdges = [...player.querySelectorAll(".timeline-path-edge")];
  const stateGrid = player.querySelector(".timeline-state-grid");
  const explanation = player.querySelector(".timeline-explanation");
  const live = player.querySelector(".timeline-live");
  const range = player.querySelector(".timeline-range");
  const counter = player.querySelector(".timeline-counter");
  const playButton = player.querySelector(".timeline-play");
  let frameIndex = 0;
  let timer = null;
  let observer = null;
  let started = false;

  function draw(announce = true) {
    const frame = definition.frames[frameIndex];
    lines.forEach((line, index) => {
      line.classList.toggle("current", index === frame.active);
      line.classList.toggle("visited", index < frame.active);
    });
    pathNodes.forEach((node, index) => node.classList.toggle("active", index === frame.path));
    pathEdges.forEach((edge, index) => edge.classList.toggle("active", index < frame.path));
    let currentSection = "";
    stateGrid.innerHTML = frame.state.map(([key, value, changed, section]) => {
      const sectionHeader = section && section !== currentSection
        ? `<div class="timeline-state-section">${escapeHtml(section)}</div>`
        : "";
      if (section) currentSection = section;
      return `${sectionHeader}
        <div class="timeline-state-row ${changed ? "changed" : ""}">
          <span class="timeline-state-key">${escapeHtml(key)}</span>
          <span class="timeline-state-value">${escapeHtml(value)}</span>
        </div>`;
    }).join("");
    explanation.innerHTML = `<strong>${escapeHtml(frame.title)}</strong>${escapeHtml(frame.text)}`;
    range.value = String(frameIndex);
    counter.textContent = `${frameIndex + 1} / ${definition.frames.length}`;
    if (announce) live.textContent = `Step ${frameIndex + 1}: ${frame.title}. ${frame.text}`;
  }

  function pause() {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    playButton.textContent = "▶";
    playButton.classList.remove("playing");
    playButton.setAttribute("aria-label", "Play animation");
  }

  function play() {
    if (timer !== null) return;
    started = true;
    if (frameIndex === definition.frames.length - 1) {
      frameIndex = 0;
      draw(false);
    }
    playButton.textContent = "❚❚";
    playButton.classList.add("playing");
    playButton.setAttribute("aria-label", "Pause animation");
    timer = window.setInterval(() => {
      if (frameIndex >= definition.frames.length - 1) {
        pause();
        return;
      }
      frameIndex += 1;
      draw();
    }, 1000);
  }

  function seek(nextIndex) {
    frameIndex = Math.max(0, Math.min(definition.frames.length - 1, nextIndex));
    draw();
  }

  player.querySelector(".timeline-prev").addEventListener("click", () => {
    started = true;
    pause();
    seek(frameIndex - 1);
  });
  player.querySelector(".timeline-next").addEventListener("click", () => {
    started = true;
    pause();
    seek(frameIndex + 1);
  });
  playButton.addEventListener("click", () => timer === null ? play() : pause());
  range.addEventListener("input", () => {
    started = true;
    pause();
    seek(Number(range.value));
  });

  draw(false);
  pause();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduceMotion && "IntersectionObserver" in window) {
    observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && !started) {
        play();
        observer.disconnect();
      }
    }, { threshold: 0.35 });
    observer.observe(player);
  } else if (!reduceMotion) {
    play();
  } else {
    pause();
  }

  timelineCleanups.push(() => {
    pause();
    if (observer) observer.disconnect();
  });
}

function mountTimelines() {
  article.querySelectorAll("[data-timeline]").forEach((host) => {
    const definition = timelineDefinitions[host.dataset.timeline];
    if (definition) mountTimeline(host, definition);
  });
}

function mountAmbientAnimations() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const targets = [...article.querySelectorAll(".flow-diagram, .step-trace, .memory-table, .layer-stack")];
  targets.forEach((target) => {
    const children = target.matches(".step-trace")
      ? target.querySelectorAll(".trace-step")
      : target.matches(".memory-table")
        ? target.querySelectorAll(".memory-row")
        : target.matches(".layer-stack")
          ? target.querySelectorAll(".layer")
          : [];
    children.forEach((child, index) => child.style.setProperty("--reveal-index", index));
  });
  if (!("IntersectionObserver" in window)) {
    targets.forEach((target) => target.classList.add("animate-in"));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("animate-in");
      if (!entry.target.matches(".flow-diagram")) observer.unobserve(entry.target);
    });
  }, { threshold: 0.2 });
  targets.forEach((target) => observer.observe(target));
  timelineCleanups.push(() => observer.disconnect());
}

function labShell(title, mission, controls) {
  return `
    <section class="lab-shell" aria-label="${escapeHtml(title)}">
      <div class="lab-titlebar">
        <span class="lab-title"><span class="terminal-dots"><i></i><i></i><i></i></span>${escapeHtml(title)}</span>
        <span class="lab-badge">PLAYGROUND</span>
      </div>
      <p class="lab-mission"><strong>MISSION:</strong> ${mission}</p>
      <div class="lab-grid">
        <div class="lab-controls">${controls}</div>
        <div class="lab-output"><span class="lab-output-label">live result</span><div class="lab-result"></div><div class="lab-log" aria-live="polite"></div></div>
      </div>
    </section>`;
}

function labRows(rows) {
  return `<div class="lab-readout">${rows.map(([key, value, hot]) => `
    <div class="lab-row"><span class="lab-key">${escapeHtml(key)}</span><span class="lab-value ${hot ? "hot" : ""}">${escapeHtml(String(value))}</span></div>`).join("")}</div>`;
}

function mountPltResolverLab(host) {
  host.innerHTML = labShell(
    "PLT/GOT RESOLVER LAB",
    "Switch binding modes, restart the process, and predict whether the next call enters the loader.",
    `<div class="lab-control"><label class="lab-control-label" for="lab-binding">Binding mode</label><select id="lab-binding" class="lab-select"><option value="lazy">lazy · resolve on first call</option><option value="now">immediate · resolve at startup</option></select></div>
     <div class="lab-actions"><button class="lab-button primary lab-call" type="button">call puts()</button><button class="lab-button lab-restart" type="button">restart process</button></div>`
  );
  const mode = host.querySelector(".lab-select");
  const result = host.querySelector(".lab-result");
  const log = host.querySelector(".lab-log");
  let calls = 0;
  let resolverRuns = 0;
  let got = "";

  function restart() {
    calls = 0;
    resolverRuns = mode.value === "now" ? 1 : 0;
    got = mode.value === "now" ? "0x7ffff7e41980 → libc puts" : "0x401036 → PLT+6 resolver path";
    log.textContent = mode.value === "now"
      ? "startup: ld.so resolved puts and patched GOT before main()"
      : "startup: GOT points back into PLT; loader has not resolved puts";
    render();
  }

  function render(hot = "") {
    result.innerHTML = labRows([
      ["PLT address", "0x401030 · R-X code", hot === "plt"],
      ["PLT bytes", "ff 25 ca 2f 00 00 …", false],
      ["GOT slot", "0x404000 · 8-byte data", false],
      ["GOT value", got, hot === "got"],
      ["puts calls", calls, hot === "call"],
      ["resolver runs", resolverRuns, hot === "resolver"]
    ]);
  }

  host.querySelector(".lab-call").addEventListener("click", () => {
    calls += 1;
    if (got.startsWith("0x401036")) {
      resolverRuns += 1;
      got = "0x7ffff7e41980 → libc puts";
      log.textContent = `call ${calls}: PLT read unresolved GOT → loader ran → GOT data changed → puts ran`;
      render("got");
    } else {
      log.textContent = `call ${calls}: PLT read resolved GOT → jumped directly to libc puts`;
      render("call");
    }
  });
  host.querySelector(".lab-restart").addEventListener("click", restart);
  mode.addEventListener("change", restart);
  restart();
}

function mountFdTableLab(host) {
  host.innerHTML = labShell(
    "FILE DESCRIPTOR TABLE LAB",
    "Create aliases to one open file, change the read size, and discover which state is shared.",
    `<div class="lab-control"><label class="lab-control-label">Selected descriptor</label><select class="lab-select lab-fd-select"></select></div>
     <div class="lab-control"><label class="lab-control-label">Read size <span class="lab-control-value lab-read-size-label">32 bytes</span></label><input class="lab-range lab-read-size" type="range" min="1" max="256" value="32" /></div>
     <div class="lab-actions"><button class="lab-button primary lab-open" type="button">open file</button><button class="lab-button lab-dup" type="button">dup selected</button><button class="lab-button lab-read" type="button">read</button><button class="lab-button lab-close" type="button">close</button><button class="lab-button lab-reset" type="button">reset</button></div>`
  );
  const select = host.querySelector(".lab-fd-select");
  const size = host.querySelector(".lab-read-size");
  const sizeLabel = host.querySelector(".lab-read-size-label");
  const result = host.querySelector(".lab-result");
  const log = host.querySelector(".lab-log");
  let table = new Map();
  let descriptions = new Map();
  let nextDescription = 0;

  const nextFd = () => {
    let fd = 3;
    while (table.has(fd)) fd += 1;
    return fd;
  };
  const selectedFd = () => Number(select.value);

  function render(message = "Choose open file to begin.") {
    const previous = select.value;
    const descriptors = [...table.keys()].sort((a, b) => a - b);
    select.innerHTML = descriptors.length
      ? descriptors.map((fd) => `<option value="${fd}">fd ${fd}</option>`).join("")
      : `<option value="">no open descriptors</option>`;
    if (descriptors.includes(Number(previous))) select.value = previous;
    const slots = [0, 1, 2, ...descriptors].map((fd) => {
      if (fd < 3) return `<div class="lab-object"><span>fd ${fd}</span><span>terminal ${["stdin", "stdout", "stderr"][fd]}</span><span>reserved</span></div>`;
      const id = table.get(fd);
      return `<div class="lab-object"><span>fd ${fd}</span><span>pointer → open description ${id}</span><span>handle</span></div>`;
    }).join("");
    const objects = [...descriptions.entries()].map(([id, item]) => `<div class="lab-object winner"><span>object ${id}</span><span>offset ${item.offset} · refs ${item.refs}</span><span>kernel</span></div>`).join("");
    result.innerHTML = `<span class="lab-output-label">per-process descriptor slots</span><div class="lab-object-list">${slots}</div><span class="lab-output-label" style="margin-top:14px">open file descriptions</span><div class="lab-object-list">${objects || '<div class="lab-object"><span>—</span><span>none</span><span>kernel</span></div>'}</div>`;
    log.textContent = message;
    const disabled = descriptors.length === 0;
    host.querySelector(".lab-dup").disabled = disabled;
    host.querySelector(".lab-read").disabled = disabled;
    host.querySelector(".lab-close").disabled = disabled;
  }

  host.querySelector(".lab-open").addEventListener("click", () => {
    const fd = nextFd();
    const id = String.fromCharCode(65 + nextDescription++);
    table.set(fd, id);
    descriptions.set(id, { offset: 0, refs: 1 });
    render(`open: kernel created object ${id}; table[${fd}] now points to it; C received integer ${fd}`);
    select.value = String(fd);
  });
  host.querySelector(".lab-dup").addEventListener("click", () => {
    const source = selectedFd();
    const id = table.get(source);
    const fd = nextFd();
    table.set(fd, id);
    descriptions.get(id).refs += 1;
    render(`dup(${source}): table[${fd}] received the same pointer to ${id}; no new file offset was created`);
    select.value = String(fd);
  });
  host.querySelector(".lab-read").addEventListener("click", () => {
    const fd = selectedFd();
    const id = table.get(fd);
    const item = descriptions.get(id);
    const count = Number(size.value);
    const start = item.offset;
    item.offset += count;
    render(`read(${fd}, …, ${count}): object ${id} supplied bytes ${start}–${item.offset - 1}; shared offset is now ${item.offset}`);
    select.value = String(fd);
  });
  host.querySelector(".lab-close").addEventListener("click", () => {
    const fd = selectedFd();
    const id = table.get(fd);
    table.delete(fd);
    const item = descriptions.get(id);
    item.refs -= 1;
    if (item.refs === 0) descriptions.delete(id);
    render(item.refs === 0 ? `close(${fd}): last reference removed; kernel destroyed object ${id}` : `close(${fd}): slot cleared; object ${id} remains alive with ${item.refs} reference(s)`);
  });
  host.querySelector(".lab-reset").addEventListener("click", () => {
    table = new Map();
    descriptions = new Map();
    nextDescription = 0;
    render("reset: descriptor slots 3 and above are empty");
  });
  size.addEventListener("input", () => { sizeLabel.textContent = `${size.value} bytes`; });
  render();
}

function mountPageDecoderLab(host) {
  host.innerHTML = labShell(
    "VIRTUAL ADDRESS DECODER",
    "Move an address across page boundaries, then change mapping state and predict whether access succeeds.",
    `<div class="lab-control"><label class="lab-control-label">Virtual address <span class="lab-control-value lab-address-label"></span></label><input class="lab-range lab-address" type="range" min="0" max="1048575" step="1" value="21450" /></div>
     <div class="lab-control"><label class="lab-control-label">Page size</label><select class="lab-select lab-page-size"><option value="4096">4 KiB</option><option value="16384">16 KiB</option><option value="65536">64 KiB</option></select></div>
     <div class="lab-control"><label class="lab-control-label">Page-table entry</label><select class="lab-select lab-present"><option value="present">present → physical frame 42</option><option value="missing">not present</option></select></div>
     <div class="lab-control"><label class="lab-control-label">Attempt</label><select class="lab-select lab-access"><option value="read">read</option><option value="write">write</option></select></div>
     <div class="lab-control"><label class="lab-control-label">Permission</label><select class="lab-select lab-permission"><option value="read">R--</option><option value="write">RW-</option></select></div>
     <div class="lab-actions"><button class="lab-button primary lab-translate" type="button">translate + access</button></div>`
  );
  const address = host.querySelector(".lab-address");
  const addressLabel = host.querySelector(".lab-address-label");
  const pageSize = host.querySelector(".lab-page-size");
  const present = host.querySelector(".lab-present");
  const access = host.querySelector(".lab-access");
  const permission = host.querySelector(".lab-permission");
  const result = host.querySelector(".lab-result");
  const log = host.querySelector(".lab-log");

  function render(runAccess = false) {
    const virtual = Number(address.value);
    const size = Number(pageSize.value);
    const offsetBits = Math.log2(size);
    const page = Math.floor(virtual / size);
    const offset = virtual % size;
    const physical = 42 * size + offset;
    addressLabel.textContent = `0x${virtual.toString(16).padStart(5, "0")}`;
    const bits = virtual.toString(2).padStart(20, "0").split("").map((bit, index) => `<span class="lab-bit ${index >= 20 - offsetBits ? "offset" : ""}">${bit}</span>`).join("");
    result.innerHTML = `${labRows([
      ["virtual", `0x${virtual.toString(16).padStart(5, "0")}`],
      ["virtual page", page, true],
      ["page offset", `0x${offset.toString(16)} · ${offset}`, true],
      ["PTE", present.value === "present" ? "frame 42 · " + (permission.value === "write" ? "RW-" : "R--") : "not present"],
      ["physical", present.value === "present" ? `0x${physical.toString(16)}` : "unknown until fault resolves"]
    ])}<span class="lab-output-label" style="margin-top:12px">20-bit teaching address · green bits are offset</span><div class="lab-bits">${bits}</div>`;
    if (!runAccess) {
      log.textContent = `address ÷ page size = page ${page}, remainder ${offset}; the remainder becomes the within-page offset`;
    } else if (present.value === "missing") {
      log.textContent = `${access.value}: page-table entry is absent → CPU raises page fault → kernel must map/load a frame or send a signal`;
    } else if (access.value === "write" && permission.value !== "write") {
      log.textContent = "write: translation exists but page is R-- → protection fault → typically SIGSEGV";
    } else {
      log.textContent = `${access.value}: page ${page} → frame 42; preserve offset 0x${offset.toString(16)} → physical address 0x${physical.toString(16)}`;
    }
  }

  [address, pageSize, present, access, permission].forEach((control) => control.addEventListener("input", () => render(false)));
  host.querySelector(".lab-translate").addEventListener("click", () => render(true));
  render(false);
}

function mountStackBudgetLab(host) {
  host.innerHTML = labShell(
    "THREAD STACK BUDGET",
    "Keep total reserved stack address space below 1 GiB while giving each worker enough room.",
    `<div class="lab-control"><label class="lab-control-label">Initial RLIMIT_STACK <span class="lab-control-value lab-main-label"></span></label><input class="lab-range lab-main-stack" type="range" min="1" max="64" value="8" /></div>
     <div class="lab-control"><label class="lab-control-label">Worker threads <span class="lab-control-value lab-thread-label"></span></label><input class="lab-range lab-thread-count" type="range" min="1" max="256" value="32" /></div>
     <div class="lab-control"><label class="lab-control-label">Stack source</label><select class="lab-select lab-stack-source"><option value="default">NPTL default from initial limit</option><option value="explicit">explicit pthread_attr size</option></select></div>
     <div class="lab-control lab-explicit-control"><label class="lab-control-label">Explicit worker stack <span class="lab-control-value lab-worker-label"></span></label><input class="lab-range lab-worker-stack" type="range" min="0.25" max="16" step="0.25" value="2" /></div>
     <div class="lab-control"><label class="lab-control-label">Pages actually touched <span class="lab-control-value lab-touch-label"></span></label><input class="lab-range lab-touch" type="range" min="1" max="100" value="10" /></div>`
  );
  const main = host.querySelector(".lab-main-stack");
  const threads = host.querySelector(".lab-thread-count");
  const source = host.querySelector(".lab-stack-source");
  const worker = host.querySelector(".lab-worker-stack");
  const touch = host.querySelector(".lab-touch");
  const result = host.querySelector(".lab-result");
  const log = host.querySelector(".lab-log");

  function render() {
    const mainMb = Number(main.value);
    const count = Number(threads.value);
    const workerMb = source.value === "default" ? mainMb : Number(worker.value);
    const touched = Number(touch.value);
    const reserved = mainMb + count * workerMb;
    const residentEstimate = reserved * touched / 100;
    host.querySelector(".lab-main-label").textContent = `${mainMb} MiB`;
    host.querySelector(".lab-thread-label").textContent = String(count);
    host.querySelector(".lab-worker-label").textContent = `${Number(worker.value).toFixed(2)} MiB`;
    host.querySelector(".lab-touch-label").textContent = `${touched}%`;
    host.querySelector(".lab-explicit-control").style.opacity = source.value === "explicit" ? "1" : "0.45";
    result.innerHTML = `${labRows([
      ["main mapping", `${mainMb} MiB`],
      ["each worker", `${workerMb.toFixed(2)} MiB`],
      ["worker mappings", `${count} × ${workerMb.toFixed(2)} MiB`],
      ["virtual reserved", `${reserved.toFixed(2)} MiB`, true],
      ["rough resident", `${residentEstimate.toFixed(2)} MiB at ${touched}% touched`]
    ])}<div class="lab-meter"><span class="${reserved > 2048 ? "danger" : reserved > 1024 ? "warning" : ""}" style="width:${Math.min(100, reserved / 2048 * 100)}%"></span></div><span class="lab-output-label" style="margin-top:6px">meter scale · 0 to 2 GiB reserved</span>`;
    log.textContent = reserved <= 1024
      ? `within mission budget: ${reserved.toFixed(2)} MiB ≤ 1024 MiB. Reserved virtual space is not the same as resident RAM.`
      : `budget exceeded by ${(reserved - 1024).toFixed(2)} MiB. Try fewer threads or a smaller explicit worker stack.`;
  }

  [main, threads, source, worker, touch].forEach((control) => control.addEventListener("input", render));
  render();
}

function mountSymbolScopeLab(host) {
  host.innerHTML = labShell(
    "SYMBOL LOOKUP SCOPE",
    "Reorder loaded objects, choose a symbol, and predict which definition the loader finds first.",
    `<div class="lab-control"><label class="lab-control-label">Symbol to resolve</label><select class="lab-select lab-symbol"><option>connect</option><option>malloc</option><option>puts</option><option>foo</option><option>SSL_read</option></select></div>
     <div class="lab-control"><label class="lab-control-label">Lookup rule</label><select class="lab-select lab-lookup"><option value="default">RTLD_DEFAULT · begin at scope start</option><option value="next">RTLD_NEXT · begin after libshim</option></select></div>
     <p class="lab-control-label">Use ↑ and ↓ to change lookup order</p><div class="lab-object-list lab-scope-editor"></div>`
  );
  const symbol = host.querySelector(".lab-symbol");
  const lookup = host.querySelector(".lab-lookup");
  const editor = host.querySelector(".lab-scope-editor");
  const result = host.querySelector(".lab-result");
  const log = host.querySelector(".lab-log");
  let objects = [
    { name: "app", symbols: ["foo"] },
    { name: "libshim.so", symbols: ["connect", "puts"] },
    { name: "libssl.so.3", symbols: ["SSL_read"] },
    { name: "libc.so.6", symbols: ["connect", "malloc", "puts"] }
  ];

  function render() {
    const target = symbol.value;
    const shimIndex = objects.findIndex((object) => object.name === "libshim.so");
    const start = lookup.value === "next" ? shimIndex + 1 : 0;
    const winnerIndex = objects.findIndex((object, index) => index >= start && object.symbols.includes(target));
    editor.innerHTML = objects.map((object, index) => `
      <div class="lab-object ${index === winnerIndex ? "winner" : ""}">
        <span>${index}</span><span>${escapeHtml(object.name)}</span>
        <span class="lab-actions"><button class="lab-mini-button" data-move="up" data-index="${index}" ${index === 0 ? "disabled" : ""} aria-label="Move ${escapeHtml(object.name)} earlier">↑</button><button class="lab-mini-button" data-move="down" data-index="${index}" ${index === objects.length - 1 ? "disabled" : ""} aria-label="Move ${escapeHtml(object.name)} later">↓</button></span>
      </div>`).join("");
    result.innerHTML = `<span class="lab-output-label">search begins at index ${start}</span><div class="lab-object-list">${objects.map((object, index) => `
      <div class="lab-object ${index === winnerIndex ? "winner" : ""}"><span>${index < start ? "skip" : index === winnerIndex ? "win" : "scan"}</span><span>${escapeHtml(object.name)}</span><span>${escapeHtml(object.symbols.join(", "))}</span></div>`).join("")}</div>`;
    log.textContent = winnerIndex === -1
      ? `${target}: no definition exists in the searched portion of this scope`
      : `${target}: first matching definition is ${objects[winnerIndex].name} at scope index ${winnerIndex}`;
  }

  editor.addEventListener("click", (event) => {
    const button = event.target.closest("[data-move]");
    if (!button) return;
    const index = Number(button.dataset.index);
    const other = button.dataset.move === "up" ? index - 1 : index + 1;
    [objects[index], objects[other]] = [objects[other], objects[index]];
    render();
  });
  symbol.addEventListener("change", render);
  lookup.addEventListener("change", render);
  render();
}

const labMounts = {
  "plt-resolver": mountPltResolverLab,
  "fd-table": mountFdTableLab,
  "page-decoder": mountPageDecoderLab,
  "stack-budget": mountStackBudgetLab,
  "symbol-scope": mountSymbolScopeLab
};

function mountLabs() {
  article.querySelectorAll("[data-lab]").forEach((host) => {
    const mount = labMounts[host.dataset.lab];
    if (mount) mount(host);
  });
}

function renderToc(query = "") {
  const normalized = query.trim().toLowerCase();
  const html = groups.map((group) => {
    const matches = group.entries.filter((entry) => {
      const haystack = `${entry.title} ${entry.question} ${entry.summary} ${entry.group || ""}`.toLowerCase();
      return !normalized || haystack.includes(normalized);
    });
    if (!matches.length) return "";
    const collapsed = !normalized && state.collapsed.has(group.title);
    return `
      <section class="toc-group ${collapsed ? "collapsed" : ""}" data-group="${escapeHtml(group.title)}">
        <button class="toc-heading" aria-expanded="${!collapsed}">
          <span>${escapeHtml(group.title)}</span><span>⌄</span>
        </button>
        <div class="toc-items">
          ${matches.map((entry) => `
            <a class="toc-link ${entry.slug === state.current ? "active" : ""} ${state.read.has(entry.slug) ? "read" : ""}"
              href="#${entry.slug}" data-route="${entry.slug}">${escapeHtml(entry.title)}</a>`).join("")}
        </div>
      </section>`;
  }).join("");
  toc.innerHTML = html || `<p class="toc-empty">No concepts match “${escapeHtml(query)}”.</p>`;
}

function renderArticle(slug, pushFocus = false) {
  const entry = bySlug.get(slug) || bySlug.get("readme");
  disposeTimelines();
  state.current = entry.slug;
  state.read.add(entry.slug);
  storage.set("linux-field-guide-read", JSON.stringify([...state.read]));

  const index = entries.findIndex((item) => item.slug === entry.slug);
  const previous = entries[index - 1];
  const next = entries[index + 1];
  const connections = (entry.connections || []).map((connectedSlug) => bySlug.get(connectedSlug)).filter(Boolean);

  article.innerHTML = `
    <header class="article-header">
      <div class="eyebrow">${escapeHtml(entry.group)} · ${String(index + 1).padStart(2, "0")}</div>
      <h1>${escapeHtml(entry.question)}</h1>
      <p class="deck">${escapeHtml(entry.summary)}</p>
    </header>
    <div class="article-body">
      ${entry.body}
      ${connections.length ? `
        <section class="connections">
          <h2>Connected concepts</h2>
          <div class="connection-list">
            ${connections.map((item) => `<a href="#${item.slug}" data-route="${item.slug}">${escapeHtml(item.title)} →</a>`).join("")}
          </div>
        </section>` : ""}
      ${entry.refs?.length ? `
        <details class="external-links">
          <summary>Authoritative references and deeper reading</summary>
          <ul>${entry.refs.map(([label, url]) => `<li><a href="${url}" target="_blank" rel="noreferrer">${escapeHtml(label)} ↗</a></li>`).join("")}</ul>
        </details>` : ""}
      <nav class="article-nav" aria-label="Article navigation">
        ${previous ? `<a href="#${previous.slug}" data-route="${previous.slug}"><span>← Previous</span><strong>${escapeHtml(previous.title)}</strong></a>` : "<span></span>"}
        ${next ? `<a href="#${next.slug}" data-route="${next.slug}"><span>Next →</span><strong>${escapeHtml(next.title)}</strong></a>` : `<a href="#readme" data-route="readme"><span>Complete</span><strong>Return to the beginning</strong></a>`}
      </nav>
    </div>`;

  mountTimelines();
  mountLabs();
  mountAmbientAnimations();

  document.title = `${entry.title} · Linux Systems Field Guide`;
  renderToc(search.value);
  updateProgress();
  window.scrollTo({ top: 0, behavior: "auto" });
  document.body.classList.remove("nav-open");
  if (pushFocus) article.focus({ preventScroll: true });
}

function updateProgress() {
  const count = entries.filter((entry) => state.read.has(entry.slug)).length;
  progressLabel.textContent = `${count} / ${entries.length}`;
  progressBar.style.width = `${(count / entries.length) * 100}%`;
}

function navigateFromHash(pushFocus = false) {
  const slug = decodeURIComponent(location.hash.slice(1)) || "readme";
  renderArticle(slug, pushFocus);
}

document.addEventListener("click", (event) => {
  const route = event.target.closest("[data-route]");
  if (route) {
    const slug = route.dataset.route;
    if (location.hash === `#${slug}`) {
      event.preventDefault();
      renderArticle(slug, true);
    }
  }

  const heading = event.target.closest(".toc-heading");
  if (heading) {
    const groupElement = heading.closest(".toc-group");
    const groupName = groupElement.dataset.group;
    if (state.collapsed.has(groupName)) state.collapsed.delete(groupName);
    else state.collapsed.add(groupName);
    storage.set("linux-field-guide-collapsed", JSON.stringify([...state.collapsed]));
    renderToc(search.value);
  }
});

search.addEventListener("input", () => renderToc(search.value));
search.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    const first = toc.querySelector(".toc-link");
    if (first) first.click();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && document.activeElement !== search) {
    event.preventDefault();
    search.focus();
  }
  if (event.key === "Escape") {
    search.value = "";
    search.blur();
    renderToc();
    document.body.classList.remove("nav-open");
  }
});

document.getElementById("reset-progress").addEventListener("click", () => {
  state.read.clear();
  storage.remove("linux-field-guide-read");
  state.read.add(state.current);
  renderToc(search.value);
  updateProgress();
});

document.getElementById("menu-button").addEventListener("click", () => document.body.classList.add("nav-open"));
document.getElementById("sidebar-close").addEventListener("click", () => document.body.classList.remove("nav-open"));
document.getElementById("backdrop").addEventListener("click", () => document.body.classList.remove("nav-open"));

const themeToggle = document.getElementById("theme-toggle");
const savedTheme = storage.get("linux-field-guide-theme");
if (savedTheme) document.documentElement.dataset.theme = savedTheme;
themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = nextTheme;
  storage.set("linux-field-guide-theme", nextTheme);
});

window.addEventListener("hashchange", () => navigateFromHash(true));
navigateFromHash();
