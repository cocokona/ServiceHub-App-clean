---
name: Pro-Density Admin
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#434656'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#737688'
  outline-variant: '#c3c5d9'
  surface-tint: '#004ced'
  primary: '#003ec7'
  on-primary: '#ffffff'
  primary-container: '#0052ff'
  on-primary-container: '#dfe3ff'
  inverse-primary: '#b7c4ff'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#3f4f65'
  on-tertiary: '#ffffff'
  tertiary-container: '#57677e'
  on-tertiary-container: '#d6e6ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b7c4ff'
  on-primary-fixed: '#001452'
  on-primary-fixed-variant: '#0038b6'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#d3e4fe'
  tertiary-fixed-dim: '#b7c8e1'
  on-tertiary-fixed: '#0b1c30'
  on-tertiary-fixed-variant: '#38485d'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
  mono-sm:
    fontFamily: monospace
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 24px
---

## Brand & Style
The design system is engineered for professional, high-density data environments where speed of information processing and structural clarity are paramount. The personality is authoritative, precise, and utilitarian, minimizing decorative flourishes in favor of organizational hierarchy. 

The aesthetic follows a **Corporate / Modern** approach with a focus on "Compact" density. It leverages high-contrast structural elements—such as a deep-toned navigation sidebar—to provide a grounding frame for information-heavy content areas. The design system prioritizes a "function-first" emotional response, evoking trust through systematic alignment and predictable interactions.

## Colors
The palette is built on a foundation of "Slate" neutrals to manage visual noise in complex layouts. 

- **Primary (#0052FF):** A vibrant, high-visibility blue used exclusively for primary actions, progress indicators, and active states.
- **Secondary (#0F172A):** A deep navy "Midnight Slate" used for the global sidebar and primary headers to create a strong structural silhouette.
- **Tertiary (#64748B):** A muted slate used for secondary text, icons, and non-essential UI borders.
- **Neutral (#F8FAFC):** A cool-toned background white that reduces eye strain during long sessions of data analysis.
- **Status Tones:** Success (Emerald 600), Warning (Amber 500), and Error (Rose 600) are used with high saturation for immediate legibility against the neutral canvas.

## Typography
The system utilizes **Inter** across all roles to ensure maximum legibility at small scale. 

- **Density:** Body text is set at 14px for standard use and 13px for dense data tables. 
- **Hierarchy:** Use semi-bold (600) for headlines to provide clear section breaks. 
- **Labels:** Small caps or uppercase labels are used for metadata and table headers to distinguish them from actionable data.
- **Monospace:** Technical values, IDs, and financial figures should use a system monospace font to ensure numerical alignment.

## Layout & Spacing
The design system employs a **Fluid Grid** model based on a 4px baseline rhythm, optimized for "Compact" density.

- **Grid:** A 12-column layout for desktop with 16px gutters.
- **Sidebar:** A fixed-width sidebar (240px) that can collapse to an icon-only rail (64px).
- **Density:** Padding within components (cards, table cells) is tight—typically 8px or 12px—to maximize the amount of visible data on a single screen.
- **Breakpoints:**
  - Mobile (< 768px): Single column, hidden sidebar (drawer).
  - Tablet (768px - 1280px): Compact sidebar, 12-column fluid grid.
  - Desktop (> 1280px): Full sidebar, max-width content container of 1600px.

## Elevation & Depth
This design system uses **Tonal Layers** and **Low-contrast outlines** rather than heavy shadows to maintain a clean, professional look.

- **Level 0 (Background):** Neutral #F8FAFC.
- **Level 1 (Cards/Surface):** Pure White (#FFFFFF) with a 1px border in #E2E8F0. No shadow.
- **Level 2 (Dropdowns/Popovers):** Pure White with a subtle, tight ambient shadow (0px 4px 6px -1px rgba(0, 0, 0, 0.1)) to indicate temporary overlay.
- **Sidebar Depth:** The sidebar uses its dark background (#0F172A) to create perceived depth against the light content area without needing physical elevation.

## Shapes
The shape language is **Soft** (4px radius) to maintain a modern feel while appearing disciplined and structured. 

- **Standard (4px):** Used for buttons, inputs, and small cards.
- **Large (8px):** Used for main content containers and modal windows.
- **Interactive:** Active states in navigation use a 4px radius highlight. Checkboxes use a 2px radius for a sharp, technical look.

## Components
- **Buttons:** Primary buttons are solid #0052FF with white text. Secondary buttons are ghost-style with a #E2E8F0 border. Standard height is 32px for high-density layouts.
- **Tables:** The core of the system. Row height is fixed at 40px. Headers are sticky with a subtle bottom border. Use alternating row stripes or hover states for tracking.
- **Inputs:** 32px height, 1px border (#E2E8F0). Focus state uses a 1px #0052FF border and a subtle blue halo.
- **Chips/Badges:** Small, 20px height, using light tinted backgrounds (e.g., light green background with dark green text for "Success").
- **Cards:** Used as "data buckets." Minimal padding (16px). Headers within cards should have a 1px bottom divider.
- **Status Indicators:** Small 8px dots or highly condensed badges for "Live," "Error," or "Pending" states.