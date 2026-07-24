# Illustration Brief and Prompt Contract

## 1. Build the brief

Write these fields before calling the image tool:

| Field | Required content |
| --- | --- |
| Reader judgment | One sentence the reader should retain. |
| Visual job | Overview flow, state/recovery map, comparison board, layered model, or visual summary. |
| Supported nodes | Exact components, actors, states, or compared items. |
| Supported edges | Exact direction, loop, branch, handoff, or dependency. |
| Critical boundary | Failure, recovery, permission, cost, version, or safety limit that must remain visible. |
| Closed labels | Exact title and 6–14 short labels; no model-authored extras. |
| Article placement | Section, caption purpose, and nearby precise representation. |

If the article cannot support these fields, do not generate the image yet.

## 2. Shape the prompt

Use this structure:

```text
Use case: infographic-diagram
Asset type: Tego Arch article illustration for "<article title>"
Primary request: explain <reader judgment> through <visual job>
Reference images: style reference only; do not copy people, mascots, signatures, watermarks, wording, or composition
Scene/backdrop: warm white paper, generous margins
Style/medium: original Chinese hand-drawn technical whiteboard infographic, flat 2D marker lines, editorially polished
Composition/framing: 16:9 landscape; <chosen grammar>; one dominant reading path; 4–7 major groups
Color palette: deep blue main flow, orange decisions, green success, red failure only, charcoal text
Text (verbatim): "<title>"; "<label 1>"; ...; "<label N>"
Architecture: nodes <list>; edges <list>; critical boundary <boundary>
Constraints: simplified Chinese; exact topology; labels separated from arrows; readable at article width; color is not the only state cue
Avoid: extra labels, pseudo-Chinese, paragraphs, photorealism, 3D, brand marks, logos, signatures, watermarks, copied characters, copied layouts, decorative circuit-board imagery
```

Do not add a person by default. If a guide figure materially improves orientation, request a small, original, project-neutral cartoon engineer with no resemblance to any reference person and no signature.

## 3. Visual QA

Inspect at original resolution, then at approximately 720 px width.

- **Text:** every character matches the closed-label list; no extra text.
- **Topology:** all arrows, loops, branches, states, and groups match the brief.
- **Scope:** no unsupported guarantee, metric, version, product mark, or invented scenario.
- **Hierarchy:** title first, dominant path second, boundary and conclusion third.
- **Accessibility:** relationships remain understandable without color; alt text describes the purpose rather than every pixel.
- **Responsive fit:** labels remain legible; no critical content touches the crop edge.
- **Originality:** no recognizable reference character, signature, watermark, or copied arrangement.

Apply only one targeted correction per iteration. If exact text cannot be repaired, reduce the label count or generate empty label boxes and add deterministic text in a separate editable layer.
