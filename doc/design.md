---
description: BitLibrary v2.0 - Design System and Style Guide
---

# 🎨 BitLibrary Design System

This document serves as the single source of truth for the **BitLibrary v2.0** visual identity. It ensures a consistent, high-fidelity, and "Bitcraft-inspired" experience across all components.

---

## 🖤 Color Palette (Dark Theme)

| Token | Hex/Value | Usage |
| :--- | :--- | :--- |
| **`bit-bg`** | `#050505` | Main application background. |
| **`bit-panel`** | `#0a0a0a` | Cards, sidebars, and overlays. |
| **`bit-border`** | `#1f1f1f` | Subtle borders for glassmorphism. |
| **`bit-accent`** | `#ff4d00` | Branding, primary CTAs, and focus states. |
| **`bit-accentDim`** | `rgba(255, 77, 0, 0.1)` | Hover backgrounds and subtle glows. |
| **`bit-text`** | `#ededed` | Primary body text. |
| **`bit-muted`** | `#888888` | Metadata, captions, and secondary info. |

---

## 🔡 Typography

- **Display Font:** `Space Grotesk` (For headers, Hero sections, and Big Titles).
- **Sans Font:** `Inter` (For general UI, buttons, and navigation).
- **Mono Font:** `JetBrains Mono` (For metadata, technical info, and codes).

---

## ✨ UI Patterns & Micro-Interactions

### 1. Glassmorphism
- **Effect:** `backdrop-blur(12px)`.
- **Background:** `rgba(10, 10, 10, 0.7)`.
- **Border:** `1px solid rgba(255, 255, 255, 0.08)`.

### 2. The "Bitcraft" Aesthetic
- **Grid Pattern:** A subtle background grid using `bit-border` lines.
- **Scanlines:** A vertical animation over large sections to create a "terminal/hacker" vibe.
- **Accent Glows:** Using `box-shadow` with `bit-accent` and a high blur radius for buttons and icons.

### 3. Layouts (The Bento Grid)
- Use a **Bento-style grid** for high-level collections.
- Large cards for featured topics (e.g., Quantum Era).
- Medium/Small cards for categories (e.g., Philosophy, Science).

---

## 📚 Component-Specific Guidelines

- **Book Cards:**
    - Height: Fixed to maintain grid alignment.
    - Gradient: Dynamic cover gradients (e.g., `from-blue-900 to-black`).
    - Hover: Scale up (1.02) and subtle border glow in `bit-accent`.
- **The Reader:**
    - Background: Deep black (`bit-bg`).
    - Typography: Generous line-height (1.6) and high-contrast text for reading comfort.
    - Animation: Fade-in text as it "streams" from AI.

---

## 🚀 CSS Implementation Status (Tailwind)
The system is currently configured via the `tailwind.config` object in `index.html`. 

```javascript
tailwind.config = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        bit: {
          bg: '#050505',
          panel: '#0a0a0a',
          border: '#1f1f1f',
          accent: '#ff4d00',
          accentDim: 'rgba(255, 77, 0, 0.1)',
          text: '#ededed',
          muted: '#888888'
        }
      }
    }
  }
}
```
