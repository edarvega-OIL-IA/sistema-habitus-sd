---
name: Sistema Habitus SD
description: Business management system for sports supplement retail
colors:
  charcoal: "oklch(0.205 0 0)"
  charcoal-light: "oklch(0.269 0 0)"
  warm-white: "oklch(1 0 0)"
  soft-gray: "oklch(0.97 0 0)"
  medium-gray: "oklch(0.556 0 0)"
  border-gray: "oklch(0.922 0 0)"
  teal-accent: "oklch(0.488 0.243 264.376)"
  alert-red: "oklch(0.577 0.245 27.325)"
  offer-teal: "#00a19a"
  chart-1: "oklch(0.87 0 0)"
  chart-2: "oklch(0.556 0 0)"
  chart-3: "oklch(0.439 0 0)"
  chart-4: "oklch(0.371 0 0)"
  chart-5: "oklch(0.269 0 0)"
typography:
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.2
  mono:
    fontFamily: "Geist Mono, Consolas, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.625rem"
  xl: "0.875rem"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.charcoal}"
    textColor: "{colors.warm-white}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 0.625rem"
  button-outline:
    backgroundColor: "{colors.warm-white}"
    textColor: "{colors.charcoal}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 0.625rem"
  card:
    backgroundColor: "{colors.warm-white}"
    rounded: "{rounded.xl}"
    padding: "{spacing.lg}"
  input:
    backgroundColor: "{colors.warm-white}"
    textColor: "{colors.charcoal}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 0.625rem"
---

# Design System: Sistema Habitus SD

## Overview

**Creative North Star: "The Efficient Workshop"**

Sistema Habitus SD is designed as a tool-focused workspace where every element serves operational efficiency. The interface is restrained and utilitarian—no decorative flourishes, no unnecessary hierarchy. Like a well-organized workshop where every tool has its place and is immediately accessible, the system prioritizes speed, clarity, and minimal friction in daily retail operations.

The visual language is built on a neutral achromatic base (charcoal and warm white) with functional color accents used sparingly for status signals and key actions. Typography is clean and legible, optimized for rapid scanning of product names, prices, and financial data. Layout density balances information richness with breathing room—screens pack substantial data without feeling cramped.

The system deliberately avoids the "polished dashboard" aesthetic common in enterprise SaaS. Instead, it embraces directness: buttons look like buttons, inputs are clearly defined, navigation is literal. This straightforward approach matches the operational context—a two-person team managing both counter sales and back-office tasks, where UI friction directly translates to customer wait time.

**Key Characteristics:**
- Achromatic neutral base with minimal color
- High information density without clutter
- Immediate clarity over visual sophistication
- Keyboard-optimized workflows
- Consistent spacing and alignment rhythm
- Functional typography hierarchy

## Colors

The palette is strictly utilitarian: an achromatic foundation with functional accents that signal status and guide attention.

### Primary
- **Charcoal** (oklch(0.205 0 0)): The system's workhorse color. Used for primary buttons, sidebar background, key text, and active navigation. Near-black but with slightly lifted lightness for reduced eye strain during long sessions.

### Accent
- **Teal Accent** (oklch(0.488 0.243 264.376)): Reserved for sidebar primary actions in dark mode and occasional interactive highlights. Appears rarely—its scarcity is intentional.
- **Offer Teal** (#00a19a): Functional accent for promotional pricing in the web storefront. Distinct from the system teal to maintain clear semantic separation between internal tools and customer-facing commerce.

### Neutral
- **Warm White** (oklch(1 0 0)): Background color for cards, inputs, main content areas. Pure white without the clinical harshness—subtle warmth for extended viewing.
- **Soft Gray** (oklch(0.97 0 0)): Secondary backgrounds, muted surfaces, disabled states. One step below warm white for subtle layering.
- **Medium Gray** (oklch(0.556 0 0)): Secondary text, labels, subdued information. Passes WCAG AA for normal text against white.
- **Border Gray** (oklch(0.922 0 0)): Dividers, input borders, card edges. Visible but unobtrusive.

### Functional
- **Alert Red** (oklch(0.577 0.245 27.325)): Destructive actions, validation errors, fiscal rejection warnings. High chroma for immediate recognition.

### Chart Colors
- **Chart Scale** (chart-1 through chart-5): Stepped grayscale sequence from light to dark for data visualization. Monochromatic by design—color is a distraction in financial reporting where numbers carry the meaning.

### Named Rules
**The Monochrome Default Rule.** Charts, graphs, and data visualizations use the five-step grayscale palette. Color appears only for status (red for loss, teal for highlight). Readability through contrast, not hue.

## Typography

**Body Font:** Inter (Google Fonts, with system-ui fallback)
**Mono Font:** Geist Mono (Google Fonts, with Consolas fallback)

**Character:** Inter provides clarity and neutrality—a workhorse sans-serif optimized for UI density and screen legibility. The system uses it at 14px (0.875rem) as the base, sized for rapid scanning of product lists and financial tables. Geist Mono appears sparingly for CUIT numbers, product codes, and timestamps where alignment and character-width consistency matter.

### Hierarchy

- **Body** (400 weight, 0.875rem, 1.5 line-height): Default text for all content—product names, prices, table cells, form labels. No display or headline scale; the system has no marketing surfaces that need typographic drama.
- **Label** (500 weight, 0.875rem, 1.2 line-height): Form labels, button text, navigation items, section headings. Weight increase (not size) signals hierarchy without breaking the density rhythm.
- **Mono** (400 weight, 0.875rem, 1.4 line-height): CUIT, barcode references, transaction IDs, timestamps. Tighter line-height than body for compact tabular data.

### Named Rules
**The Single-Size Rule.** The entire interface operates at 14px base. Headers use weight, not size, for hierarchy. This enforces density and eliminates the visual noise of competing type scales.

## Layout

The system uses a fixed left sidebar (224px / 14rem wide on desktop, drawer overlay on mobile) with a top header bar (48px / 3rem tall). Content areas span the remaining viewport with consistent 24px (1.5rem) padding. Forms use a single-column flow with full-width inputs; data tables span their container without horizontal scrolling except when deliberately designed for wide datasets.

**Responsive behavior:** Below 768px (md breakpoint), the sidebar collapses into a slide-out drawer triggered by a hamburger button. Dashboard stat tiles reflow from 5-column to 2-column, then single-column. The POS sales screen maintains its two-panel layout (cart left, payments right) on tablet and collapses to stacked panels on mobile.

**Density:** Spacing follows a 4px base unit. Buttons are compact (32px / 2rem height default), inputs match (32px with 8px vertical padding), and list items condense to 36-40px rows. The system prioritizes information per screen over generous whitespace—more products visible in the cart, more transactions in the recent sales list.

**Grid:** No formal grid system. Components align to natural content widths and stack with consistent 16-24px gaps. Dashboard tiles use CSS grid with equal-width columns; everything else flows naturally.

## Elevation & Depth

The system is **flat by default with functional borders**. Cards, inputs, and panels use 1px borders (border-gray) to define edges—no drop shadows in normal state. Depth is conveyed through tonal layering: charcoal sidebar against warm white content, soft-gray secondary surfaces against warm white backgrounds.

### Shadow Vocabulary

Shadows appear only as state feedback:

- **Focus Ring** (`0 0 0 3px oklch(0.708 0 0 / 50%)`): Keyboard focus indicator. Medium gray at 50% opacity, 3px offset.
- **Mobile Drawer Shadow** (`0 4px 24px rgba(0, 0, 0, 0.15)`): Soft ambient shadow when the sidebar drawer overlays content on mobile. Functional depth cue, not decoration.

### Named Rules
**The Flat-First Rule.** Surfaces are flat and border-defined at rest. Shadows appear only for state (focus, overlay, elevation changes). Never use shadows to create persistent "card float" or decorative depth.

## Shapes

**Corner strategy:** Consistently rounded with a 10px (0.625rem) base radius. Buttons, inputs, and cards all share this radius for visual cohesion. Smaller elements (chips, badges) drop to 6px (0.375rem) to maintain proportional roundness without looking pill-shaped.

**Borders:** 1px solid borders define most boundaries. Inputs have visible borders in all states (not ghost-until-focus). Tables use hairline dividers between rows (border-gray, often at reduced opacity).

**Form language:** Rectangular with gentle corners. No pill buttons, no sharp 0px corners except in data tables where alignment matters more than softness. The radius is present but restrained—functional, not playful.

## Components

### Buttons

- **Shape:** Rounded corners (10px), consistent padding (8px vertical, 10px horizontal default)
- **Primary:** Charcoal background, white text. Hover state darkens slightly (80% opacity). Active state translates down 1px for tactile feedback.
- **Outline:** White background, charcoal border (1px), charcoal text. Hover fills with soft-gray.
- **Ghost:** Transparent background, charcoal text. Hover fills with soft-gray.
- **Destructive:** Alert-red background at 10% opacity, alert-red text. Hover increases to 20% opacity.
- **Size variants:** Default (32px height), sm (28px), lg (36px), icon-only (32px square). All maintain the same horizontal padding rhythm.

### Inputs / Fields

- **Style:** 1px solid border (border-gray), 10px radius, white background, 8px vertical padding
- **Focus:** Border color shifts to medium-gray, 3px ring in medium-gray at 50% opacity
- **Error:** Border and ring change to alert-red
- **Disabled:** Opacity 50%, pointer-events disabled

### Cards / Containers

- **Corner Style:** 14px radius (rounded-xl)
- **Background:** Warm white
- **Shadow Strategy:** None—flat with 1px border (border-gray)
- **Border:** Optional 1px border in border-gray when contrast against background is needed
- **Internal Padding:** 24px (1.5rem) standard, 16px (1rem) for dense lists

### Chips / Badges

- **Style:** Small rounded rectangles (6px radius), text-only or icon+text
- **Status chips:** Background color at low opacity (10-20%) with full-opacity text in the same hue. Examples: "Con diferencia" (alert-red/10 bg, alert-red text), "Cuadrada" (soft-gray bg, charcoal text)
- **Offer badge:** Teal-accent background, white text, 10px text, semibold weight
- **Sin Stock badge:** Medium-gray background, white text, 10px text

### Navigation

**Sidebar (desktop):** 224px fixed width, charcoal background, white text. Active item has teal-accent background (light mode) or teal-accent text (dark mode). Icons use emoji for immediate recognition (intentional low-fi choice—no icon library overhead).

**Mobile drawer:** Slides in from left with dark backdrop overlay. Identical styling to desktop sidebar but positioned absolute with transform animation (200ms ease-in-out).

**Grouped nav items:** "Artículos" submenu expands/collapses with chevron indicator. Submenu items indent and use slightly reduced font size (0.8rem).

### Data Tables

- **Row height:** Compact 36-40px for density
- **Borders:** Hairline dividers between rows (border-gray), no vertical dividers
- **Hover:** Soft-gray background fill
- **Header:** Medium-weight labels, border-bottom to separate from data
- **Alignment:** Numbers right-aligned, text left-aligned

### Dashboard Stat Tiles

- **Style:** Card component with centered content
- **Layout:** Icon or emoji at top, large number (1.5-2rem), label below
- **Color:** Charcoal text for numbers, medium-gray for labels
- **Responsive:** 5-column grid on desktop (≥1024px), 2-column on tablet, single-column on mobile

## Do's and Don'ts

### Do:

- **Do** use the 10px base radius consistently across buttons, inputs, and cards
- **Do** maintain the 14px base font size throughout—no display or headline sizes
- **Do** right-align numeric data in tables for easy scanning
- **Do** use 1px borders to define component boundaries—shadows are for state only
- **Do** keep spacing increments to 4px multiples (8px, 12px, 16px, 24px)
- **Do** use medium-weight (500) for labels and navigation; regular (400) for body text
- **Do** validate color contrast meets WCAG AA for all text
- **Do** use emoji navigation icons (⊞ Dashboard, 🛒 Ventas, etc.) for immediate visual recognition

### Don't:

- **Don't** add decorative shadows or depth effects—the system is intentionally flat
- **Don't** introduce additional font sizes—the single-size hierarchy is a defining constraint
- **Don't** use color as the sole indicator of state—combine with text, icons, or borders
- **Don't** create pill-shaped buttons (50% radius)—keep the 10px rounded rectangle
- **Don't** add marketing or decorative copy—every word serves operational function
- **Don't** use auto-generated color palettes or Material Design presets—this system has a custom achromatic foundation
- **Don't** break the keyboard-first workflow—every critical action must have a keyboard shortcut or natural tab-order access
