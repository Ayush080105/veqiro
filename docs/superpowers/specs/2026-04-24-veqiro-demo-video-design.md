# Veqiro Product Demo Video — Design Spec
_Date: 2026-04-24_

## Context

Veqiro needs a short-form product demo video for Twitter/X and Instagram to drive top-of-funnel awareness. The website already has strong copy and brand identity (irreverent, personality-driven AI crew) but no video asset. This video will serve as the primary social media content introducing the product to cold audiences. Built with Remotion (video-in-React) inside the existing monorepo.

---

## Specs

| Property | Value |
|---|---|
| Format | 9:16 vertical (1080 × 1920) |
| Duration | ~40 seconds (1200 frames) |
| FPS | 30 |
| Audio | Background music only (no voiceover) — music file added manually |
| Platform | Twitter/X, Instagram Reels |
| Style | Story-driven: chaos → crew → CTA |

---

## Scene Breakdown

| Scene | Time | Frames | Description |
|---|---|---|---|
| 1 · Chaos Hook | 0–3s | 0–90 | Dark `#111` bg. Work items fly in: "147 unread emails", "3 meetings", "5 decks". Each item slams in with a spring animation. Energetic, overwhelmed feeling. |
| 2 · Pivot | 3–6s | 90–180 | Cream `#EFE7D6` bg. Large text fades in: **"what if you had a crew?"** — single question, centered, Bagel Fat One font. |
| 3 · Brand Reveal | 6–9s | 180–270 | Dark bg. "HIRE YOUR" in yellow (`#F5C518`) slides up, then "WEIRDOS" in red (`#F06464`) slams in below it. Veqiro logo fades in underneath. |
| 4 · Crew Parade | 9–22s | 270–660 | Each of the 6 crew members appears in sequence (~2s each). Each entry: colored background flash → portrait photo → name + role label slides up. Order: Vega (blue), Scout (yellow), Maya (red), Sage (pink), Lex (violet), Rex (green). |
| 5 · How It Works | 22–31s | 660–930 | Dark bg. Three steps count in one by one with a stagger: `01 Pick your crew` → `02 Brief them` → `03 Go touch grass`. Each step fades + slides up. |
| 6 · Pricing Punch | 31–36s | 930–1080 | Cream bg. Six crew member name pills appear in a wrap grid. Then "less than a bad intern" (Archivo Black) + `$39/mo` badge (yellow on black) punches in. |
| 7 · CTA Close | 36–40s | 1080–1200 | Yellow `#F5C518` bg. "7 days free. No credit card." fades in. Black button: `hire the crew →`. `veqiro.com` in small mono below. |

---

## Project Structure

New Remotion app scaffolded at `apps/video/` inside the existing Turborepo monorepo.

```
apps/video/
├── package.json
├── remotion.config.ts
├── src/
│   ├── index.ts              ← registerRoot
│   ├── Root.tsx              ← registers the composition (1080×1920, 1200fr, 30fps)
│   ├── VideoDemo.tsx         ← top-level, sequences all scenes via <Series>
│   ├── scenes/
│   │   ├── ChaosHook.tsx     ← Scene 1
│   │   ├── PivotLine.tsx     ← Scene 2
│   │   ├── BrandReveal.tsx   ← Scene 3
│   │   ├── CrewParade.tsx    ← Scene 4 (renders all 6 members)
│   │   ├── HowItWorks.tsx    ← Scene 5
│   │   ├── PricingPunch.tsx  ← Scene 6
│   │   └── CTAClose.tsx      ← Scene 7
│   └── shared/
│       ├── constants.ts      ← brand colors, crew data array, font names
│       └── animations.ts     ← shared spring/interpolate helpers
└── public/
    └── (symlinked or copied crew portraits from apps/landing/public/)
```

---

## Key Implementation Details

### Composition registration (`Root.tsx`)
```tsx
<Composition
  id="VeqiroDemo"
  component={VideoDemo}
  durationInFrames={1200}
  fps={30}
  width={1080}
  height={1920}
/>
```

### Scene sequencing (`VideoDemo.tsx`)
Use `<Series>` from `remotion` to stitch scenes. Each scene component receives `durationInFrames` and uses `useCurrentFrame()` + `useVideoConfig()` internally.

```tsx
<Series>
  <Series.Sequence durationInFrames={90}><ChaosHook /></Series.Sequence>
  <Series.Sequence durationInFrames={90}><PivotLine /></Series.Sequence>
  <Series.Sequence durationInFrames={90}><BrandReveal /></Series.Sequence>
  <Series.Sequence durationInFrames={390}><CrewParade /></Series.Sequence>
  <Series.Sequence durationInFrames={270}><HowItWorks /></Series.Sequence>
  <Series.Sequence durationInFrames={150}><PricingPunch /></Series.Sequence>
  <Series.Sequence durationInFrames={120}><CTAClose /></Series.Sequence>
</Series>
```

### Animation pattern (all scenes)
- **Springs:** `spring({ frame, fps, config: { damping: 12, stiffness: 180 } })` for punchy entries
- **Interpolation:** `interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' })` for opacity fades
- **Stagger:** offset frame by `index * 8` per item inside loops

### Brand constants (`shared/constants.ts`)
```ts
export const COLORS = {
  bg: '#EFE7D6', ink: '#111111', cream: '#FFF9ED',
  red: '#F06464', yellow: '#F5C518', green: '#1DBC87',
  pink: '#F79FD4', violet: '#8A8AF0', blue: '#6FCDE8',
};

export const CREW = [
  { name: 'VEGA',  role: 'Executive Assistant',    color: COLORS.blue,   photo: 'Vega.jpeg'  },
  { name: 'SCOUT', role: 'Research & Strategist',  color: COLORS.yellow, photo: 'Scout.jpeg' },
  { name: 'MAYA',  role: 'Content & Marketing',    color: COLORS.red,    photo: 'Maya.jpeg'  },
  { name: 'SAGE',  role: 'SEO Specialist',          color: COLORS.pink,   photo: 'Sage.jpeg'  },
  { name: 'LEX',   role: 'Legal Assistant',         color: COLORS.violet, photo: 'Lex.jpeg'   },
  { name: 'REX',   role: 'Data Analyst & Finance', color: COLORS.green,  photo: 'Rex.jpeg'   },
];
```

### Fonts
Load via `@remotion/google-fonts`:
- `Bagel Fat One` — display headlines
- `Archivo Black` — labels and sub-headers
- `Space Grotesk` — body/supporting text
- `JetBrains Mono` — `veqiro.com` CTA line

### Images
Copy crew portrait JPEGs from `apps/landing/public/` into `apps/video/public/`. Reference via `staticFile('Vega.jpeg')` etc. (Symlinks are unreliable in Remotion's webpack bundler — use direct copies.)

---

## Audio

- Add a background music track (royalty-free, upbeat, ~40s) manually to `apps/video/public/music.mp3`
- Mount via `<Audio src={staticFile('music.mp3')} volume={0.6} />` in `VideoDemo.tsx`
- Music file is **not** committed to git (too large) — added locally before rendering

---

## Rendering

```bash
# Preview in Remotion Studio
cd apps/video && npx remotion studio

# Single-frame sanity check (1-second mark)
npx remotion still VeqiroDemo --scale=0.25 --frame=30

# Full render
npx remotion render VeqiroDemo out/veqiro-demo.mp4
```

---

## Verification

1. `npx remotion studio` launches and shows the 40s timeline
2. Scrubbing through each scene boundary shows correct transition
3. Crew parade shows all 6 members with correct name/color/photo
4. Single-frame render at frames 0, 270, 660, 930, 1080 validates each major scene
5. Full render produces `out/veqiro-demo.mp4` at 1080×1920
6. Video plays correctly on mobile (vertical fill, text readable)
