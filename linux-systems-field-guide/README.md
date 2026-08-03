# Linux Systems Field Guide

A dependency-free, single-page glossary for Linux, ELF, pthread, and advanced C concepts.

Open `index.html` directly, or serve the directory locally:

```sh
python3 -m http.server 8080 --directory doc/linux-systems-glossary
```

Then visit <http://localhost:8080>.

The site stores reading progress, collapsed navigation groups, and theme preference in browser local storage. Every concept has a stable hash URL such as `#symbol-interposition`.

Interactive timelines autoplay at one step per second when scrolled into view. They can be paused, stepped, or scrubbed, and remain paused when the browser requests reduced motion.

Hands-on playgrounds let readers change lazy-binding behavior, manipulate a shared file offset, decode a virtual address, budget thread stacks, and reorder dynamic-symbol lookup scope.
