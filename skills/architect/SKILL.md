---
name: architect
description: "Sketch types, signatures, and modules before code. Use when the user asks to architect or design something, or when the shape of new code isn't obvious."
disable-model-invocation: true
---

# Architect

Before writing code, trace every system the change touches, then sketch two different shapes for it (types, signatures, module boundaries) and pick the one where each piece of state has one owner, each task has one way to do it, and callers need to know least. Redesign instead of patching if workarounds repeat.

For a large or contested design, run the [shootout](../shootout/SKILL.md) skill for it instead of sketching alone.
