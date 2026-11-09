# Registry row format (shared by every research cell)

Every technology a cell evaluates gets one row in its own file
`research/<cell>/registry.md`, as a Markdown table with exactly these columns:

| Name | URL | Function | Code licence | Model/weights licence | Verified on | Quality /20 | Ziggy fit /20 | Perf /15 | Maturity /10 | Docs /10 | Licence & commercial /15 | Running cost /10 | Score /100 | Decision | Justification |

Rules
- "Verified on" = the date you read the LICENSE file / model card yourself (2026-11-09); write "unverified" otherwise.
- Code licence and weights licence are separate. Unknown or non-commercial weights score 0 on "Licence & commercial" and can never be "adopt".
- Project rules (CLAUDE.md): shipped code MIT / Apache-2.0 / BSD only (ISC and Unicode-3.0 need/have owner OK); never GPL/AGPL/LGPL/MPL/NC in what ships; zero new running cost (prefer offline pre-generation and code-built assets); child safety red lines (no child image/voice/data to third parties; no free LLM chat for children).
- Decision: adopt (we use it now), test (worth a prototype), reject (with the reason).
- Running cost /10: 10 = runs offline at build time or in the browser for free; 0 = paid per use at runtime.
