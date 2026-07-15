# ServiceHub-App

> **ServiceHub Pro** — a cross-platform home-services marketplace (mobile) connecting customers with technicians for cleaning, repair, electrical, and beauty services.

This repository is a portfolio piece demonstrating production-grade full-stack engineering: a React Native / Expo client backed by a Supabase (PostgreSQL) data layer, with a security-hardened schema, offline-first sync, and tokenized payments.

---

## 🛠 Skills & Technologies

**Mobile & Frontend**
- React Native 0.86 · Expo 57 · TypeScript
- NativeWind (Tailwind for RN) · React Navigation 7
- Advanced CSS · glass-morphism · responsive typography · micro-interactions
- Laravel · Livewire · FluxUI · Alpine.js (web stack)
- Three.js / WebGL (immersive, performance-tuned experiences)

**Backend & Data**
- Supabase: Auth · Realtime · Storage · Row-Level Security (RLS)
- PostgreSQL: versioned SQL migrations, triggers, functions
- REST API design & full-stack integration

**Engineering Quality**
- Offline-first architecture: layered caching (memory → AsyncStorage → Supabase), incremental sync, conflict resolution (last-write-wins)
- Security hygiene: no plaintext secrets in client, tokenized payments (no PAN/CVV stored), RLS-enforced isolation
- Testing: Vitest unit suites · `tsc --noEmit` type safety
- Performance: 60fps targets, lazy loading, optimized asset delivery

---

## 🚀 Notable Work

**ServiceHub Pro — Marketplace Platform** *(this repository)*
Led architecture and implementation of a complete home-services marketplace:
- Rebuilt auth on Supabase Auth with `profiles` table and full RLS row isolation (replacing an insecure custom-users approach).
- Designed a three-tier offline cache with incremental pull and an offline mutation queue (exponential backoff, LRU eviction).
- Implemented tokenized payment methods (brand/last4/exp only — no full card data) with Luhn + validity pre-validation.
- Built a reviews/ratings system with a DB trigger maintaining technician averages.
- Enforced role & category rules (technicians accept only matching categories; earnings visible only on completed jobs).

**Premium Web Experiences — Laravel / Livewire / FluxUI**
Marketing and SaaS front-ends with glass-morphism surfaces, magnetic interactions, and light/dark/system theming — balancing craft with sub-1.5s loads.

**Immersive 3D Showcases — Three.js**
WebGL hero sections and interactive product viewers (particle systems, parallax) tuned to 60fps on mid-range hardware.

---

## 📫 Contact

- ✉️ Email: *coco135d@gmail.com*

---

## ©️ Usage Notice

This README and the contents of this repository (code, documentation, and assets) are provided for **personal, professional demonstration only**.

**Any business use, reproduction, redistribution, or sharing — in whole or in part — requires prior written permission.** Please contact me via one of the links above before using or sharing this content in any commercial or public context.

---

<sub>Last updated: 2026-07-15</sub>
