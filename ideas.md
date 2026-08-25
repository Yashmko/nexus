# NEXUS UI Design Directions

## Three possible directions

| Theme Name | Very Brief Intro | Probability |
| --- | --- | --- |
| **Forensic Timeline** | A precise, monochrome mission replay that makes each security decision inspectable and reversible. It feels like an investigation ledger rather than a conventional dashboard. | 0.07 |
| **Neural Command Deck** | An AI-first cockpit where the orchestrator sits at the center of a live agent network. It communicates coordination and autonomy through connection patterns and motion. | 0.04 |
| **Evidence Constellation** | A graph-led investigation environment that treats each finding as a network of proof, relationships, and confidence. It supports careful validation over raw scan output. | 0.09 |

## Chosen Direction — Forensic Timeline

**Design Movement.** A restrained hybrid of forensic software, high-end developer tooling, and editorial information design. The UI deliberately avoids neon cyberpunk tropes and generic KPI dashboards in favor of a chronological security narrative.

**Core Principles.** The mission is always legible at a glance. Every consequential action should be tied to scope, evidence, approval, and a responsible agent. Color is semantic rather than decorative. Dense data is separated through rhythm, alignment, and typographic hierarchy instead of excessive containers.

**Color Philosophy.** Charcoal, ink, graphite, and off-white form the dependable base so the operator can work for long periods without visual fatigue. Muted green means validated or authorized, muted red means rejected or critical, muted amber means pending approval, and a restrained blue-gray marks the active point of focus. Color must never duplicate information already conveyed by words or icons.

**Layout Paradigm.** A persistent utility rail anchors the operator. The main workspace follows a mission spine: ten stages arranged chronologically, evidence and hypothesis cards branching below the relevant stage, and operational controls fixed to the lower region. The layout behaves like a reviewable case file rather than a grid of unrelated widgets.

**Signature Elements.** The mission spine makes progress, branches, and decision points visible. Hypothesis branches show both disproved and validated paths. A chain-of-custody-style evidence panel preserves what happened, when, and why. Small agent identity markers make agency visible without becoming decoration.

**Interaction Philosophy.** Controls are deliberate and reversible. Stage selection refocuses the timeline; hypothesis cards reveal linked evidence; approval actions use confirmation language and a compact confirmation state. Hover and focus states increase precision without distracting animation.

**Animation.** Status changes use short 160–220 ms opacity and transform transitions. The active timeline cursor advances subtly, while event trails use a low-contrast pulse only when motion is not reduced. No looping visual effects compete with evidence review. All non-essential motion is disabled under reduced-motion preferences.

**Typography System.** `Space Grotesk` gives mission headings and stage numbers an engineered, technical rhythm. `IBM Plex Mono` is used for timestamps, tool output, confidence values, and evidence identifiers. The visual hierarchy depends on size, tracking, and weight—not bright color.

**Brand Essence.** NEXUS is an AI security operating system for authorized teams that turns security testing into an explainable, evidence-backed mission. **Measured, accountable, incisive.**

**Brand Voice.** Headlines are factual, active, and specific; CTAs name the precise consequence of an action; microcopy states the reason for a limitation or decision. Example lines: “Review the evidence before advancing the mission.” and “Validation closed this hypothesis with 91% confidence.”

**Wordmark & Logo.** A compact four-point nexus mark represents four converging evidence paths, paired with a sharply tracked NEXUS wordmark. The mark uses intersecting angular strokes and remains identifiable at icon scale.

**Signature Brand Color.** **Signal Slate** (`#8DA4B5`) is the ownable cool blue-gray used for the active timeline point, keyboard focus, and selected mission context.

## Style Decisions

- The mission spine is the dominant organizing artifact: hypotheses, evidence, agent actions, and approvals must visually attach to their chronological stage.
- `Space Grotesk` carries mission titles, stage labels, hypothesis names, and decision states; `IBM Plex Mono` is reserved for timestamps, identifiers, tool output, confidence values, and agent logs.
- The four-point NEXUS mark and Signal Slate (`#8DA4B5`) recur only around active mission context, selected evidence paths, and convergence points.
- The material language favors ruled investigation ledgers, custody metadata, and decision records over conventional dashboard cards.
