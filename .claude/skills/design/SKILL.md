---
name: daw-frontend-design
description: Design frontend interfaces with a music production software (DAW) aesthetic — dark professional UIs with channel strips, knobs, faders, VU meters, waveform displays, transport controls, and rack-mount styling. Use this skill whenever the user wants a UI that looks like Ableton Live, FL Studio, Logic Pro, Pro Tools, or any audio/music production software. Also trigger when the user mentions "DAW", "mixer", "channel strip", "studio interface", "music production UI", "audio workstation", "synth UI", "plugin interface", "rack mount", or wants any dark, professional, knob-and-fader style interface — even if the underlying data isn't audio-related. This skill is about the VISUAL LANGUAGE of music production software applied to any frontend.
---

# DAW Frontend Design Skill

Create frontend interfaces that channel the unmistakable aesthetic of professional music production software — the dark, dense, hyper-functional look of DAWs (Digital Audio Workstations) like Ableton Live, FL Studio, Logic Pro, and hardware rack units.

This aesthetic works brilliantly beyond music: dashboards, dev tools, monitoring UIs, control panels, settings interfaces, and any app that benefits from a "mission control" feeling of dense, organized, expert-level UI.

## Design Philosophy

DAW interfaces are the pinnacle of **information-dense, dark-theme professional UI**. They communicate:
- **Expertise & control** — every pixel serves a function
- **Real-time responsiveness** — things move, glow, react
- **Hardware heritage** — skeuomorphic knobs, faders, meters rooted in physical gear
- **Organized density** — tons of information, but spatially logical

The soul of this aesthetic is the tension between **analog warmth** (knobs, wood panels, LED glow) and **digital precision** (pixel grids, waveforms, numerical readouts).

## Core Visual Language

### Color System

Build the palette around these DAW conventions:

**Background tiers** (darkest to lightest):
- `--bg-deep: #0D0D0F` — deepest background, outer frame
- `--bg-surface: #1A1A1E` — primary panels (channel strips, main areas)
- `--bg-raised: #232328` — raised elements (buttons, input fields)
- `--bg-hover: #2C2C33` — hover/active states

**Accent colors** (use sparingly for signal/state):
- `--accent-green: #00FF87` — active/on/signal present (LED style)
- `--accent-amber: #FFB800` — warning/caution/solo
- `--accent-red: #FF3B30` — clip/overload/record/mute
- `--accent-cyan: #00D4FF` — selected/focused/send
- `--accent-purple: #A855F7` — automation/effects

**Text hierarchy:**
- `--text-primary: #E0E0E4` — main labels
- `--text-secondary: #808088` — secondary info, inactive
- `--text-dim: #505058` — decorative labels, grid marks

**Glow effects** — key to the DAW feel:
```css
.led-active {
  color: var(--accent-green);
  text-shadow: 0 0 6px var(--accent-green), 0 0 12px rgba(0, 255, 135, 0.3);
}
.meter-clip {
  background: var(--accent-red);
  box-shadow: 0 0 8px rgba(255, 59, 48, 0.6);
}
```

### Typography

Use monospaced or condensed technical fonts. These sell the "studio gear" look:

**Primary choices (import from Google Fonts):**
- **Labels/Controls:** `'JetBrains Mono'`, `'IBM Plex Mono'`, `'Share Tech Mono'`
- **Readouts/Values:** `'Digital-7'` style or `'Orbitron'` for that LCD/LED display feel
- **Section Headers:** `'Barlow Condensed'`, `'Oswald'`, or `'Anton'` — tight, uppercase, industrial

**Typography rules:**
- ALL CAPS for section labels and channel names
- Monospaced for all numerical values — they must align vertically
- Small font sizes (10–12px) are authentic — DAWs pack information tight
- Letter-spacing: 0.05–0.12em for uppercase labels
- Use `font-variant-numeric: tabular-nums` for all numbers

### Key UI Components

Read `references/components.md` for detailed implementation patterns of each component below.

#### 1. Channel Strips (Vertical)
The backbone of any mixer view. Tall, narrow columns containing:
- Channel name (top, uppercase, small)
- Input meter (vertical LED-style bar)
- Pan knob (small rotary)
- Sends (small knobs in a row)
- Solo / Mute / Record arm buttons (colored squares: yellow / red / red-circle)
- Volume fader (tall vertical slider)
- Level meter (vertical, multi-segment, green→yellow→red gradient)
- dB readout at bottom (monospaced, small)

#### 2. Knobs (Rotary Controls)
CSS-only rotary knobs are iconic. Use:
- Circular element with a notch/indicator line
- Subtle metallic gradient background
- Value arc (SVG or conic-gradient)
- Tiny label below
- Value readout on hover

#### 3. Faders (Sliders)
Vertical or horizontal sliders styled as real faders:
- Narrow track with groove texture
- Wide, flat thumb (the "cap")
- dB scale markings alongside
- Subtle shadow under the thumb

#### 4. VU / Level Meters
Segmented vertical bars that show levels:
- Many small rectangles stacked vertically
- Color gradient: green (bottom) → yellow (mid) → red (top 2-3 segments)
- Segments light up from bottom
- Peak hold indicator (single segment that slowly falls)
- Background segments visible but very dim

#### 5. Transport Controls
Play / Stop / Record / Rewind / Forward:
- Chunky, tactile-looking buttons
- Record is always a red circle
- Play is a triangle
- Use SVG icons with glow on active state
- Timecode display: `HH:MM:SS:FF` in LCD-style font

#### 6. Waveform Displays
For any data that can be visualized as a wave:
- Canvas or SVG rendering
- Filled waveform with gradient (bright at peaks, dim at center)
- Center line (zero crossing)
- Grid lines at regular intervals
- Playhead as a bright vertical line
- Selection as a semi-transparent highlight

#### 7. Rack Mount Panels
Horizontal panels with "screw holes" in corners:
- Fixed height, full-width
- Brushed metal or dark textured background
- Rounded-rectangle "rack ears" on sides
- 1U, 2U, 3U height units
- Panel screws as small circles in corners

#### 8. LCD/LED Displays
Recessed displays showing values or status:
- Dark recessed background (`#0A0A0C`)
- Green, amber, or cyan text with glow
- Rounded rectangle with inner shadow
- Segmented/digital font style

### Layout Principles

**Grid everything.** DAW layouts are rigidly structured:
- Use CSS Grid for the main layout
- Channel strips are equal-width columns
- Sections are separated by 1px borders (`#2A2A2E`) or 2px gaps
- Panels snap to a grid — no arbitrary spacing

**Information hierarchy through spatial zones:**
- **Top bar:** Transport controls, tempo/BPM, time display, master section
- **Left panel:** Track list, browser, navigation
- **Center:** Main workspace (arrangement, mixer, editor)
- **Bottom panel:** Clip/detail view, piano roll, properties
- **Right panel:** Inspector, plugin chain, sends

**Borders and dividers:**
- Thin (1px) borders in `#2A2A2E` between panels
- Subtle inner shadows on recessed areas
- Beveled edges on raised elements (1px highlight top-left, 1px shadow bottom-right)

### Animation & Micro-interactions

DAW UIs feel alive. Things move in real-time:

- **Meters:** Smooth rise, slightly slower fall (use CSS transitions or requestAnimationFrame)
- **Knobs:** Rotate on drag with smooth interpolation
- **LEDs:** Subtle pulse when active (`animation: pulse 2s ease-in-out infinite`)
- **Buttons:** Quick tactile press (scale 0.95 on active, subtle brightness shift)
- **Hover states:** Gentle brightening, not dramatic color changes
- **Waveforms:** Animate the playhead smoothly across

```css
@keyframes led-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
@keyframes meter-fall {
  from { transform: scaleY(1); }
  to { transform: scaleY(0); }
}
```

### Texture & Depth

These details separate a convincing DAW UI from a flat dark theme:

- **Brushed metal:** `background: linear-gradient(135deg, #2a2a2e 25%, #232328 50%, #2a2a2e 75%)`
- **Noise/grain overlay:** Use a subtle CSS noise pattern or SVG filter for analog feel
- **Inner shadows** on recessed elements: `box-shadow: inset 0 1px 3px rgba(0,0,0,0.5)`
- **Beveled edges** on raised buttons
- **Rubber/grip textures** on fader thumbs (repeating linear-gradient stripes)
- **Panel screws:** Small circles with radial gradients in rack corners

### Responsive Considerations

Real DAWs are information-dense and don't simplify for small screens. For this aesthetic:
- Prioritize desktop-first (min 1200px ideal)
- On smaller screens, collapse side panels into tabs rather than stacking
- Never increase spacing to fill space — maintain density
- Allow horizontal scrolling for mixer channels if needed

## Implementation Checklist

When building a DAW-styled interface, verify:

- [ ] Dark background with proper tier hierarchy (deep → surface → raised)
- [ ] Monospaced font for all numerical values
- [ ] Condensed uppercase font for labels
- [ ] At least one glowing LED/accent element
- [ ] Segmented level meters (not plain progress bars)
- [ ] CSS custom properties for the full color system
- [ ] 1px borders between panels
- [ ] Inner shadows on recessed displays
- [ ] Smooth animations on interactive elements
- [ ] Tabular nums for all number displays
- [ ] Information density — tight spacing, small fonts, many controls visible

## Applying to Non-Audio UIs

The DAW aesthetic maps beautifully to other domains. Think of it as a translation:

| Audio Concept | General UI Concept |
|---|---|
| Channel strip | Data column / entity card |
| Volume fader | Any continuous value control |
| VU meter | Progress / status indicator |
| Knob | Compact parameter adjuster |
| Waveform | Time-series data, activity graph |
| Transport (play/stop) | Process controls (run/pause/stop) |
| BPM display | Key metric readout |
| Mixer | Multi-entity comparison view |
| Plugin rack | Module/tool chain |
| Piano roll | Gantt chart / timeline editor |

For detailed component code, see `references/components.md`.