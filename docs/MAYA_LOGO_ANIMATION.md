# Maya — Logo Animation Feature

Spec + hardcoded prompt library for a new Maya capability: animate a brand logo into a
10-second video using one of 100+ preset styles, no free-form prompting required.

## 1. User flow

1. User picks a logo source: **upload an image** or **use brand kit logo** (`BrandKit.logo_url`,
   see [core/brand_kit.py](../apps/ai/core/brand_kit.py)).
2. User picks a **style** from a dropdown (102 options below, grouped by category).
3. User picks **aspect ratio**: `9:16` or `16:9`.
4. Maya generates a fixed **10-second** video and returns it the same way other Maya videos
   are returned (`VideoResult` — base64 mp4 + `prompt_used`), reusing the existing pipeline in
   [core/video_gen.py](../apps/ai/core/video_gen.py) (`generate_maya_video` → `llm.generate_video`).

No LLM planning step is needed for this feature — unlike `plan_video_scenes`, the prompt per
style is **hardcoded** (listed below), not generated. The only per-request assembly is:

```
final_prompt = STYLE_PROMPTS[style_id] + "\n\n" + _LOGO_FIDELITY_GUARDRAIL
                                        + "\n\n" + _LOGO_ENDING_GUARDRAIL
                                        + "\n\n" + ASPECT_NOTE[aspect_ratio]

generate_maya_video(
    llm, final_prompt,
    images=[(logo_bytes, logo_mime)],
    aspect_ratio=aspect_ratio,     # "9:16" | "16:9"
    duration_seconds=10,           # override the 8s default
)
```

## 2. Shared guardrails (append to every style prompt)

These mirror the existing pattern in `core/video_gen.py` (`_TEXT_ACCURACY_GUARDRAIL`,
`_ENDING_GUARDRAIL`, `_LOGO_INSTRUCTION`) — same non-negotiable phrasing, adapted for a video
where the logo is the *subject*, not a corner watermark.

**`_LOGO_FIDELITY_GUARDRAIL`**
> LOGO FIDELITY — NON-NEGOTIABLE: The uploaded reference image is the ONLY subject of this
> video. Every frame builds toward, or already shows, that exact logo: identical shape,
> colors, and proportions. Do not redesign, restyle, simplify, or reinterpret it. If the logo
> contains text, every character must be spelled exactly as shown and fully legible at the
> moment the logo completes — a misspelled or altered logo is a failure, not a stylistic
> variation.

**`_LOGO_ENDING_GUARDRAIL`**
> ENDING — NON-NEGOTIABLE: By roughly the final 1.5–2 seconds, the logo is fully formed,
> centered, sharp, and at rest — camera settled, no new motion beginning. This final hold is
> a clean frame a viewer could pause on and immediately screenshot; never end mid-formation or
> mid-motion.

**Aspect-ratio composition notes** (`ASPECT_NOTE`)
- `9:16`: "Compose for vertical viewing: keep the logo centered in the middle band of the
  frame with generous clean space above and below for platform UI overlays."
- `16:9`: "Compose for widescreen viewing: center the logo with balanced negative space on
  both sides, filling the frame with the surrounding scene/effect rather than empty bars."

**Background color note:** each style below names a literal background/material where the
style calls for a specific atmosphere (e.g. fire, chrome, storm sky) — leave those as written.
For styles with a neutral/plain background (marked 🎨), swap the described color for the
brand's primary color from `BrandKit.brand_colors["primary"]` at request time.

## 3. Style library (102 styles)

Each entry is the exact hardcoded prompt sent as the "core action" — the guardrails above are
appended automatically, so don't repeat fidelity/ending instructions inside these.

### A. Elemental & Organic

1. **Vine Growth** 🎨 — Thin green vines and leaves creep in from the edges of frame, curling and branching across a soft sunlit backdrop, weaving themselves into the exact outline of the reference logo; small buds bloom into the logo's colors as the last tendrils lock into place. A faint rustle of leaves and birdsong plays under a gentle depth-of-field breathe from the camera.
2. **Sand Formation** — Desert wind blows fine sand across a flat dune plane; grains lift, swirl, and funnel into ridges that trace the logo's exact shape before the wind dies down. A soft wind-whoosh fades to silence as the camera holds a slow orbital drift.
3. **Fire Burn-In** — Against a dark scorched-paper texture, a flame licks along unseen edges, tracing the logo in glowing ember lines before the fire recedes, leaving the mark aglow with heat. A crackling-fire sound fades into a low ember hum as the camera pushes in slowly.
4. **Water Ripple Reveal** — A still, dark pond at dusk; a single droplet falls and ripples expand outward across the surface, and as they calm, the logo emerges clearly in the water's reflection. A soft water-plip and ambient hush play as the camera holds a slow overhead drift.
5. **Ice Crystal Grow** — Frost creeps across a dark glass pane in branching crystalline patterns that interlock precisely into the logo's shape, catching cold blue light as they finish forming. A delicate ice-cracking sound settles into stillness as the camera performs a macro push-in.
6. **Cloud Formation** — Wisps of cloud drift across a clear blue sky, slowly condensing and folding into the exact silhouette of the logo before dispersing at the edges. A soft high-altitude wind sound plays as the camera drifts to a gentle stop.
7. **Butterfly Swarm** — Dozens of small, brightly colored butterflies flutter in from every edge of frame, converging mid-air and folding their wings together into the exact shape and colors of the logo. Soft wingbeat flutter fades to hush as the camera holds with a gentle handheld drift.
8. **Blossom Bloom** 🎨 — A single stem grows upward against a clean backdrop, buds swelling and opening in time-lapse bloom until the petals' arrangement and colors resolve into the logo. A soft garden ambience plays as the camera pushes in slowly on the finished bloom.

### B. Liquid & Material Morph

9. **Liquid Metal Chrome** — A pool of molten chrome ripples and rises off a dark reflective surface, folding and hardening into the polished three-dimensional form of the logo. A metallic pour-and-settle sound plays as the camera orbits slowly to a stop on the glinting finished mark.
10. **Paint Splash Reveal** — Vivid paint splatters fly onto a stretched white canvas from multiple directions at once, each color landing precisely to build the exact shape and palette of the logo. A wet splatter sound plays as the camera holds locked-off, settling as the last drips stop.
11. **Ink Drop Bloom** — A single drop of dark ink hits still water in extreme slow motion, blooming outward in branching tendrils that resolve into the exact silhouette of the logo. A soft water-plip and ambient hum play as the camera holds a macro top-down angle.
12. **Watercolor Wash** — Pigment blooms and bleeds across wet watercolor paper, spreading tendrils of color that gradually settle precisely into the logo's shape and palette. A soft paper-soaked ambient hush plays as the camera performs a slow top-down push-in.
13. **Honey Pour** — A thick, glossy golden liquid pours from off-frame and pools on a dark glass surface, slowly leveling and firming into the exact glossy shape of the logo. A viscous pouring sound settles into stillness as the camera holds a close orbital drift.
14. **Marble Carve** — A rough grey stone block sits under warm gallery light; an unseen chisel strikes in rhythmic taps, dust falling away until the logo emerges in crisp bas-relief. A chipping-and-tapping sound fades to silence as the camera holds a slow push-in.
15. **Wax Seal Press** — Molten wax drips onto aged parchment, pooling into a disc; an ornate stamp descends, presses, and lifts away to reveal the logo embossed cleanly in the wax. A deep wax-press thunk plays as the camera pulls back slowly to frame the finished seal.
16. **Clay Molding** 🎨 — A block of soft clay spins on a potter's wheel as unseen hands press and shape it, the clay rising and resolving into the dimensional form of the logo. A wheel-hum and wet clay-squelch sound play as the camera settles into a slow orbital finish.

### C. Light & Energy

17. **Neon Sign Flicker** — In a dark, rain-slicked alley at night, glass neon tubing flickers to life segment by segment, precisely tracing the outline and colors of the logo. An electric buzz-and-flicker sound resolves into a steady glow hum as the camera holds locked-off.
18. **Laser Cut Reveal** — A single thin red laser line sweeps across a dark matte metal surface, cutting a glowing, precise outline of the logo with a faint wisp of smoke at the edge. A soft sci-fi hum plays as the camera pushes in on the warm-glowing cut lines.
19. **Hologram Projection** — On a dark tech console, a beam of blue light projects upward and particles of light coalesce into a slowly rotating three-dimensional holographic rendition of the logo. A soft digital chime plays as the camera orbits to settle front-on.
20. **Bokeh Light Reveal** — Out-of-focus warm bokeh lights drift across a dark frame; a rack-focus pull sharpens them into crisp points of light that resolve exactly into the logo. A soft ambient shimmer plays as the camera holds the final sharp focus.
21. **Lightning Strike** — Under a stormy night sky, a bolt of lightning forks downward and its glowing afterimage traces exactly the outline of the logo before fading to a steady glow. A rolling thunder rumble settles into calm ambient hum as the camera holds locked-off.
22. **LED Matrix Build** — A grid of small LED dots on a dark panel lights up pixel by pixel in a rippling wave, filling in until the full-resolution logo glows complete. A soft electronic ticking sound plays as the camera pushes in slowly.
23. **Sunbeam Reveal** — Dust-filled sunlight streams through a tall window across a dark wall; the shaft of light sweeps slowly, illuminating the logo painted there as it passes. A warm ambient room-tone hush plays as the camera pans to a gentle stop.
24. **Energy Ring Pulse** — Concentric rings of glowing cyan energy pulse outward from center frame against a dark backdrop, each pulse depositing more of the logo's linework until it glows complete and steady. A low synth pulse sound plays as the camera holds locked-off.

### D. Particle & Assembly

25. **Particle Swarm Assembly** — Thousands of glowing dust particles swirl chaotically through dark space, gradually organizing and snapping together into the precise three-dimensional form of the logo. A soft rising whoosh resolves into a chime as the camera holds a slow orbital drift.
26. **Confetti Burst Settle** 🎨 — A burst of colorful confetti and metallic streamers explodes outward from center frame, falling and settling on a flat surface into the exact shape of the logo. A festive pop-and-paper-flutter sound plays as the camera holds a top-down settle.
27. **Iron Filings Magnetize** — A dark surface covered in fine metallic filings shivers as an unseen magnet passes beneath it, the filings snapping into sharp ridges that trace the logo. A faint magnetic hum plays as the camera holds a macro top-down angle.
28. **Mosaic Tile Build** 🎨 — Small colored glass tiles fly in one by one from off-frame, clicking into place on a wall until they form a precise mosaic version of the logo. A crisp glass-click sound plays as the camera slowly pulls back to reveal the finished mosaic.
29. **Bubble Foam Rise** — Soap bubbles rise and cluster across a wet dark surface, popping and reforming in shifting clusters until their arrangement resolves into the logo's outline. A soft bubble-pop sound plays as the camera holds a macro angle.
30. **Firefly Gathering** — Fireflies drift through a dark forest clearing at dusk, converging into a glowing cluster that traces the exact shape of the logo before holding steady light. Night ambience and soft chirping play as the camera performs a slow dolly-in.
31. **Shattered Glass Reassemble** — Glass shards floating in dark space fly inward in reverse-shatter motion, locking together with sharp clicks into a crystalline three-dimensional version of the logo. A glass-chime sound plays as the camera orbits to a settled stop.
32. **Paper Confetti Snow** 🎨 — Small paper cutouts fall like snow in slow motion through soft light, drifting down and landing in a pile that, seen from above, forms the exact shape of the logo. A soft paper-rustle plays as the camera holds a top-down angle.

### E. Motion Graphics & Kinetic

33. **3D Extrusion Reveal** 🎨 — A flat two-dimensional version of the logo rests on a clean studio stage; it extrudes forward smoothly into a glossy three-dimensional object under soft key light. A mechanical whir settles to silence as the camera orbits slowly around the finished form.
34. **Geometric Line Draw** 🎨 — Thin glowing lines draw themselves stroke by stroke across a dark grid, precisely tracing the logo's outline before filling in with solid brand color. A soft pen-drawing sound plays as the camera holds locked-off throughout.
35. **Kinetic Zoom Assembly** 🎨 — Fragments of the logo fly in from far outside the frame at high speed with heavy motion blur, decelerating sharply and locking into their exact final positions. A whoosh-thud sound plays as the camera's rapid push-in settles to stillness.
36. **Origami Fold** 🎨 — A flat sheet of colored paper folds itself through a precise sequence of creases on a clean surface, resolving into a dimensional origami rendition of the logo. A soft paper-crease sound plays as the camera holds a slow orbital drift.
37. **Ribbon Wrap Reveal** 🎨 — A silk ribbon unspools through the air and wraps around an unseen form, tightening smoothly into the exact silhouette of the logo as its sheen catches the light. A soft fabric-slide sound plays as the camera arcs slowly around the finished shape.
38. **Cloth Unfurl** — A large fabric banner drops from above and unfurls in slow motion, wind rippling through it until it hangs still with the logo printed clearly across its surface. A fabric-whip sound settles into a gentle sway as the camera tilts up slowly.
39. **Mirror Kaleidoscope** — Symmetrical fractal shapes rotate and multiply against a dark backdrop like a kaleidoscope, gradually locking into perfect symmetry that resolves into the logo at center. A soft mechanical click plays as the camera holds a slow zoom-in.
40. **Typography Orbit** 🎨 — Individual letters and shapes from the logo drift and orbit around the center of frame like small planets, decelerating in sequence and locking into their final flat arrangement. A soft whoosh-chime plays as the camera performs a slow dolly-in.

### F. Retro & Stylized

41. **Film Burn Reveal** — Vintage film-grain texture fills the frame; a warm burn spreads across it like aged reel damage, clearing away to reveal the logo sharp and clean underneath. A projector clatter and hiss play as the camera holds locked-off, grain settling to calm.
42. **VHS Glitch-In** — Retro CRT scan-lines and tracking glitches flicker across a dark screen, the distortion gradually resolving into a clean, stable image of the logo. A static-hiss and tape-warble sound clears to silence as the camera holds locked-off.
43. **Comic Pop Burst** 🎨 — Bold halftone dots and a comic-book-style burst radiate outward from center frame, thick ink lines snapping into place to form the logo in flat comic color. A cartoon pop sound plays as the camera performs a single snap-zoom to settle.
44. **Chalkboard Draw** — Against a plain black chalkboard, chalk dust drifts as an unseen hand sketches the logo stroke by stroke in crisp white chalk lines. A soft chalk-scratch sound plays as the camera holds a slow push-in on the finished sketch.
45. **Typewriter Assemble** — Vintage paper is rolled into an old typewriter; letters stamp into place one at a time, building the logo's wordmark line by line. A rhythmic typewriter-clack sound plays as the camera holds a top-down angle on the page.
46. **Vintage Neon Marquee** — An old cinema marquee stands against a dusky sky; incandescent bulbs pop on one by one, outlining the exact shape of the logo in warm light. A filament-hum and click sound plays as the camera pulls back slowly to reveal the full marquee.
47. **Polaroid Develop** — A polaroid photograph ejects from a camera into dim light and slowly develops, the logo resolving into clear focus and full color as the chemical development completes. A camera-shutter and paper-flutter sound plays as the camera holds a top-down angle.

### G. Playful & Fun

48. **Balloon Inflate** 🎨 — Colorful balloons shaped like the logo inflate rapidly from flat to full against a clean backdrop, bobbing gently once fully formed. A squeak-and-stretch sound plays as the camera pulls back slowly to frame the finished balloons.
49. **Bouncing Blocks Build** 🎨 — Soft-edged toy blocks bounce in one by one from off-frame, stacking and locking together until they form the flat two-dimensional shape of the logo. A playful thud-and-bounce sound plays as the camera holds a slight low angle.
50. **Jelly Wobble Form** 🎨 — A blob of colorful jelly wobbles and reshapes itself through a few jiggling iterations on a clean surface before settling firmly into the exact form of the logo. A soft squish sound plays as the camera holds with a subtle handheld wobble.
51. **Rubber Stamp Press** — An oversized rubber stamp descends onto crisp white paper and presses down firmly, lifting away to reveal a clean inked print of the logo. A deep stamp-thud sound plays as the camera pulls back slowly to frame the finished print.
52. **Sticker Peel Reveal** 🎨 — In macro close-up, a hand peels back the glossy backing of a sticker, revealing the vivid, fully colored logo sticker underneath. A peel-crinkle sound plays as the camera pulls back to a clean flat-lay of the finished sticker.
53. **Bubblegum Blow** 🎨 — A pink bubblegum bubble inflates and pops into a burst of confetti-like fragments, which drift down and settle into the exact shape of the logo. A pop-and-giggle sound plays as the camera holds locked-off.
54. **Toy Building Blocks 3D** 🎨 — Interlocking plastic building blocks snap together piece by piece in a stop-motion rhythm, assembling a chunky three-dimensional block version of the logo. A click-snap sound plays as the camera settles into a slow orbital finish.
55. **Paper Airplane Formation** 🎨 — Several paper airplanes glide in from different edges of frame, banking in formation and landing precisely to arrange into the flat shape of the logo. A paper-whoosh sound plays as the camera performs a slow dolly-in.

### H. Craft & Handmade

56. **Cross-Stitch Handmade** — In macro close-up, a hand guides a needle through a fabric hoop, laying down small X-shaped stitches in thread color by color until the logo forms pixel by pixel. A soft thread-pull sound plays as the camera holds a slow top-down push-in.
57. **Embroidery Machine Stitch** — An industrial embroidery machine's needle blurs in rapid motion over taut fabric in a hoop, colored thread looping and layering into the exact lines of the logo. A whirring stitch-machine sound settles to a single final click as the camera holds locked-off.
58. **Quilted Patchwork Assemble** — On a quilting frame, fabric patches in different colors are laid down and stitched into place one at a time, edge to edge, until they form the logo's shape in patchwork. A sewing-machine hum plays as the camera performs a slow pull-back reveal.
59. **Wood Burn Pyrography** — A pyrography pen glides slowly across a pale wooden plank, scorching fine dark lines that trace the exact outline of the logo, a thin wisp of smoke curling upward. A soft searing-wood sound plays as the camera holds a close push-in.
60. **String Art Weave** — Small pins are hammered one by one into a wooden board, then colored thread stretches taut between them in crossing lines that gradually resolve into the logo. A soft thread-tension sound plays as the camera pulls back to reveal the finished piece.
61. **Leather Tooling Stamp** — On a workbench, a dampened leather hide is struck stroke by stroke with a tooling stamp and mallet, pressing the logo's outline into the leather in deep, precise grooves. A rhythmic mallet-tap sound plays as the camera holds a slow overhead push-in.
62. **Stained Glass Assemble** — Lead came channels snap together one by one, holding colored glass panes in place, until warm sunlight through a workshop window ignites the finished stained-glass logo. A soft glass-clink sound plays as the camera holds a slow push-in toward the light.
63. **Tapestry Loom Weave** — A wooden loom's shuttle passes back and forth through taut warp threads, colored weft threads building up row by row until the logo emerges woven into the fabric. A rhythmic loom-clack sound plays as the camera performs a slow top-down pull-back.

### I. Urban & Environmental

64. **Times Square Billboard** — Towering digital billboards glow among dense neon-lit skyscrapers at night; one massive screen flickers through fragments of light before resolving crisp and bright into the logo as blurred crowds move below. A muffled city hum and traffic sound play as the camera holds a slow low-angle push-in.
65. **New York Street Projection** — A narrow, rain-slicked New York street at night, steam rising from a manhole and a taxi's headlights passing in the distance; a gobo light projector throws a shape onto exposed brick that sharpens into focus as the exact logo. A soft projector-hum and distant traffic play as the camera holds a slow dolly-in.
66. **Building Facade Projection Mapping** — A downtown skyscraper's glass facade goes dark, then geometric light patterns sweep and fold across its full height in a projection-mapped show, converging into the logo lit across the building. A rising synth swell resolves to a held chord as the camera holds a wide, slow push-in.
67. **Subway Platform Poster** — A backlit advertising panel on a subway platform flickers as a train rushes past in a blur of motion and sound; once the train clears, the panel settles into a crisp, evenly lit logo advertisement. A train-rush sound fades to platform ambience as the camera holds locked-off.
68. **Graffiti Mural Spray** — On a weathered brick alley wall, spray-paint cans hiss and mist as unseen hands lay down layer after layer of color, the mural's lines sharpening until they resolve into the logo. A rhythmic spray-can hiss plays as the camera holds a slow pull-back reveal.
69. **Storefront Window Takeover** — A city storefront window display lights up at dusk, props and pedestals sliding smoothly into position, the centerpiece assembling piece by piece into a dimensional version of the logo. A soft mechanical-slide sound plays as the camera holds a slow push-in from the sidewalk.
70. **Rooftop Neon Skyline** — A night skyline of rooftop water towers and scattered neon signage; one rooftop sign flickers to life segment by segment, its neon tubing shaped exactly like the logo against the dark sky. An electric flicker-hum resolves to a steady glow as the camera holds a slow orbital drift.
71. **Drone Light Show Skyline** — Hundreds of illuminated drones hover above a city skyline at night, shifting formation in synchronized waves of light until they lock into a glowing three-dimensional logo suspended over the rooftops. A soft synth swell and distant crowd murmur play as the camera holds a wide, slow push-in.
72. **Bus Shelter Ad Panel** — A rainy city bus stop at night, a backlit shelter ad panel glows on behind fogged, condensation-streaked glass; the condensation clears in a wipe to reveal the crisp logo advertisement. A soft rain-patter sound plays as the camera holds a slow push-in.
73. **Scaffolding Wrap Unveil** — Construction scaffolding on a building facade is wrapped in taut fabric sheeting; the sheet drops away in one smooth motion, unveiling a giant printed mural of the logo across the building's face. A fabric-drop whoosh and brief applause murmur play as the camera holds a wide, slow pull-back.

### J. Space & Sci-Fi

74. **Nebula Formation** — Deep-space dust and glowing gas drift and swirl in slow motion, gravity gradually pulling the clouds into a defined form that resolves into the exact shape of the logo among distant stars. A low cosmic drone plays as the camera holds a slow orbital drift.
75. **Warp Speed Streak** — A starfield stretches into motion-blurred streaks of light rushing past the camera, then decelerates sharply as the stars snap back into sharp points that arrange into the logo. A whooshing warp sound resolves to a calm hum as the camera holds locked-off.
76. **Satellite Array Assembly** — Modular satellite panels drift together in orbit above a curved Earth horizon, solar panels unfolding and clicking into place until their combined silhouette forms the exact shape of the logo. A soft mechanical-click sound plays as the camera holds a slow orbital drift.
77. **Digital Matrix Rain** — Cascading columns of glowing green code characters fall down a dark screen, the columns aligning and locking in place until their negative space resolves into the sharp outline of the logo. A soft digital patter sound plays as the camera holds locked-off.
78. **Cyberpunk Hologram Billboard** — A rain-soaked neon street at night in a dense cyberpunk city; a massive holographic billboard flickers through corrupted, glitching frames before locking into a stable, glowing rendition of the logo. A synth hum and rain-hiss play as the camera holds a slow push-in from street level.
79. **Wormhole Reveal** — A swirling blue-white wormhole tunnel spins through deep space, its event horizon gradually stabilizing into a flat glowing plane at its center that reveals the logo sharp and lit. A deep spatial hum plays as the camera holds a slow push-in toward the center.
80. **Asteroid Field Converge** — Tumbling asteroids drift through a dark starfield, gravity slowly drawing them together until their combined silhouette locks into the exact three-dimensional shape of the logo. A low rumble and distant space hum play as the camera holds a slow orbital drift.
81. **Circuit Board Trace** — A macro shot of a green circuit board in a dark room; glowing electric current traces along copper pathways in bright pulses, lighting up in the precise pattern of the logo. A soft electronic hum plays as the camera holds a close push-in.

### K. Weather & Atmosphere

82. **Rainfall Window Reveal** — Raindrops streak down a dark windowpane at night, city bokeh lights blurring behind the glass; the droplets clear in a wipe and the lights refocus, aligning into the sharp shape of the logo. A soft rain-patter sound plays as the camera holds a slow rack-focus.
83. **Aurora Borealis** — Under a clear arctic night sky thick with stars, ribbons of green and violet aurora ripple and fold slowly across the horizon, settling into the exact shape and colors of the logo. A low icy wind sound plays as the camera holds a slow tilt-up.
84. **Snow Drift Settle** — Snow falls gently over a dark plaza at night, accumulating in a precise drift pattern on the ground that, seen from directly above, forms the logo in clean white snow. A soft snowfall hush plays as the camera holds a top-down angle.
85. **Autumn Leaves Fall** — Golden and red leaves drift down through soft afternoon light in a park, landing on a stone path in a pattern that, seen from above, resolves into the exact shape of the logo. A gentle breeze and rustling-leaf sound play as the camera holds a top-down push-in.
86. **Desert Mirage Shimmer** — Heat shimmer distorts the horizon of a sunbaked desert dune sea at midday; the wavering air gradually resolves into a sharp, stable mirage of the logo hovering just above the sand. A soft dry-wind sound plays as the camera holds locked-off.
87. **Volcanic Ash Cloud** — A dark ash cloud billows against a glowing red sky, embers glinting within the smoke as it curls and slowly settles into the precise outline of the logo. A low rumbling roar fades to a quiet ember-crackle as the camera holds a slow pull-back.
88. **Fog Roll Reveal** — Thick fog rolls slowly across a dark harbor at dawn, parting gradually to reveal the logo painted clearly on a distant pier piling as the water goes still. A soft foghorn and lapping-water sound play as the camera holds a slow push-in.

### L. Fashion & Textile

89. **Silk Scarf Drop** — A silk scarf printed with the logo billows and falls in extreme slow motion through soft studio light, folding gently as it settles flat and smooth onto a surface below. A soft fabric-rustle sound plays as the camera holds a slow top-down push-in.
90. **Sequin Shimmer Wall** — A wall of reversible sequins ripples as an unseen hand sweeps across it in smooth passes, flipping sequins color by color in a shimmering wave until the logo appears sharp and glinting. A soft sequin-shimmer rustle plays as the camera holds locked-off.
91. **Denim Patch Stitch** — On a tailor's worktable, a denim jacket lies under warm light as an embroidered patch is stitched into place edge by edge with a sewing machine, forming the logo. A steady sewing-machine hum plays as the camera holds a close push-in.
92. **Velvet Curtain Reveal** — Heavy velvet stage curtains part smoothly under a single warm spotlight, dust motes drifting through the beam as they reveal the logo painted crisp on the backdrop behind. A soft curtain-fabric sound plays as the camera holds a slow push-in.
93. **Fabric Screen Print** — A squeegee drags thick ink across a taut silkscreen mesh in one smooth, deliberate pass; the screen lifts away to reveal the logo printed crisp and saturated on the fabric beneath. A soft ink-drag sound plays as the camera holds a close top-down angle.
94. **Knit Pattern Form** — Knitting needles click rapidly in extreme close-up, colored yarn looping row by row into a patterned panel that gradually resolves into the exact shape of the logo. A rhythmic needle-click sound plays as the camera holds a slow push-in.

### M. Abstract & Experimental

95. **Oil on Water Swirl** — Colorful oil droplets spread and swirl across a shallow pool of still dark water, marbling patterns drifting and folding until they align precisely into the logo's shape and colors. A soft liquid-swirl sound plays as the camera holds a macro top-down angle.
96. **Ferrofluid Spike Form** — Black ferrofluid spreads across a white dish as unseen magnetic fields pull it into sharp, trembling spikes that rearrange until they trace the exact outline of the logo. A soft magnetic-hum sound plays as the camera holds a macro top-down push-in.
97. **Plasma Ball Arc** — A glass plasma globe crackles in a dark room, violet filaments of electricity reaching toward the glass surface and bending in sequence until they trace the shape of the logo. A soft electric-crackle sound plays as the camera holds a close push-in.
98. **UV Blacklight Reveal** — In a pitch-dark room lit only by blacklight, invisible fluorescent paint glows to life stroke by stroke on a black surface, revealing the logo in vivid glowing color. A low blacklight hum plays as the camera holds a slow push-in.
99. **X-Ray Scan Reveal** — A clinical scanner arm sweeps slowly across a dark silhouette on a table, its blue-white scan line revealing a skeletal, X-ray-style outline that resolves precisely into the logo. A soft scanner-hum and beep play as the camera holds locked-off.
100. **Thermal Heatmap Reveal** — A thermal-camera view of a dark flat surface shows a heat signature slowly warming from cool blue to hot orange, its spreading shape resolving exactly into the logo. A low electronic hum plays as the camera holds a slow push-in.
101. **Sound Wave Visualizer** — A glowing audio waveform pulses across a dark screen in sync with a low bass hum, its peaks and troughs reorganizing and locking into the exact outline of the logo. A deep bass pulse resolves to a held tone as the camera holds locked-off.
102. **Disintegration Reverse** — Scattered glowing dust and fragments drift slowly through dark space in reverse-entropy motion, converging and locking together piece by piece into the crisp, fully complete logo. A soft rising whoosh resolves to silence as the camera holds a slow orbital drift.

## 4. Dropdown labels (UI copy)

Group headers and order for the style picker:
`Elemental & Organic` · `Liquid & Material Morph` · `Light & Energy` · `Particle & Assembly` ·
`Motion Graphics & Kinetic` · `Retro & Stylized` · `Playful & Fun` · `Craft & Handmade` ·
`Urban & Environmental` · `Space & Sci-Fi` · `Weather & Atmosphere` · `Fashion & Textile` ·
`Abstract & Experimental` — options listed in the same order as section 3, numbered 1–102.

## 5. Notes for implementation

- Duration is always exactly **10 seconds** — pass `duration_seconds=10` explicitly to
  `generate_maya_video`; do not rely on its default (8s).
- Aspect ratio is user-selected (`9:16` or `16:9`) and passed straight through — no new
  aspect-ratio handling needed beyond the composition notes in section 2.
- Per [[maya-quality-loop]]: **never live-iterate on this feature's videos** during
  development — video generation is slow/pricey; review prompt changes via code review only,
  and validate visually with a small deliberate spot-check batch, not repeated live runs.
