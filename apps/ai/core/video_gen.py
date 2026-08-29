import asyncio
import base64
import logging
import math

from core.brand_kit import BrandKit, get_platform_tone
from core.image_gen import product_identity_instructions
from core.llm import (
    LLMClient,
    GEMINI_FLASH,
    MAX_VIDEO_SECONDS,
    VIDEO_DURATION_OPTIONS,
    VIDEO_SEGMENT_SECONDS,
)
from core.logo_animation_styles import LOGO_STYLE_DATA
from core.models import VideoResult

logger = logging.getLogger("video_gen")

# Beats per storyboard sheet — one 3x3 collage is generated per 10-second segment, so a
# 40s video is planned as four sheets of nine beats rather than nine beats stretched thin.
BEATS_PER_SEGMENT = 9


def segments_for(duration_seconds: int) -> int:
    """How many 10-second renders make up a video of this length."""
    return max(1, math.ceil(duration_seconds / VIDEO_SEGMENT_SECONDS))


_TEXT_ACCURACY_GUARDRAIL = (
    "TEXT ACCURACY — NON-NEGOTIABLE: Any text that appears anywhere in the video — on the "
    "product, on the brand logo, in on-screen captions, or on any label, sign, or package — "
    "must be spelled correctly and rendered legibly, with every character matching its "
    "source exactly. No garbled, duplicated, invented, or misspelled characters. A single "
    "spelling or typography error is a failure. If a piece of text cannot be rendered "
    "clearly and correctly, keep it soft-focus or out of frame rather than guessing at it."
)

_ENDING_GUARDRAIL = (
    "ENDING — NON-NEGOTIABLE: The video must end deliberately, never feel cut off. All action, "
    "camera movement, and any dialogue must fully resolve BEFORE the final moments — the last "
    "portion of the video (roughly the final second) is a held, settled closing shot: the "
    "subject at rest, the camera still or drifting to a stop, nothing new beginning. Never end "
    "mid-motion, mid-gesture, mid-word, or mid-camera-move; the final frame should look like an "
    "intentional closing frame a viewer could pause on. Never fade out, dip, or cut to black: "
    "the very last frame must still be the fully lit, composed image — a black or half-faded "
    "final frame is a failure, and it is also the frame the video is thumbnailed on."
)

_CONTINUATION_GUARDRAIL = (
    "DO NOT END HERE — NON-NEGOTIABLE: This is NOT the end of the video; more footage "
    "continues immediately from this segment's final frame. It must end IN MOTION, "
    "mid-development — the camera still moving, the action still unfolding, on a beat that "
    "visibly wants the next moment. Never settle, hold, come to rest, fade out, cut to "
    "black, land on a composed 'final' frame, or resolve the story here. Leave the subject, "
    "framing, and motion in a state the next segment can pick up from without a visible seam. "
    "Any spoken line here must still be FINISHED — completed well before the end, with the "
    "action continuing after it. Never trail a line off, break it across the cut, or let the "
    "last word be the last thing that happens: a sentence chopped mid-word is a defect, not "
    "a hand-off."
)

_PRODUCT_FIDELITY_GUARDRAIL = (
    "PRODUCT FIDELITY — NON-NEGOTIABLE: Reproduce the product from the reference image(s) "
    "EXACTLY as shown in every shot. Do not alter its shape, proportions, colors, materials, "
    "finish, or design details. Do not add, remove, resize, or reposition any part of it. "
    "The product must look like the same physical object in every frame, not a redesigned "
    "or reimagined version of it."
)

# Extension segments get no reference images of their own — they inherit the product
# through the interaction chain — so the guardrail points at the established footage.
_PRODUCT_FIDELITY_CONTINUED = (
    "PRODUCT FIDELITY — NON-NEGOTIABLE: The product must stay EXACTLY as it appears in the "
    "footage so far — same shape, proportions, colors, materials, finish, logo, and "
    "typography. Do not redesign, restyle, relabel, or subtly drift it as the shot "
    "continues; it is the same physical object in every frame of the finished video."
)

def _speech_budget(duration_seconds: int) -> tuple[int, int]:
    """Roughly how much spoken language a film of this length can actually carry.

    Natural delivery is ~2.5 words/second, and a commercial is not wall-to-wall talk — about
    half the runtime carries speech, the rest breathes. Derived rather than hardcoded so it
    scales with whatever durations the product offers.
    """
    words = max(6, round(duration_seconds * 0.5 * 2.5))
    lines = max(1, round(words / 8))
    return words, lines


_SCENE_PLAN_OPENING_SHORT = """\
You are an award-winning commercial director and cinematographer writing a single
continuous action description for a world-class, premium AI-generated video advertisement.
Output ONLY that description — no preamble, no markdown, no headings, no shot numbers, and
NEVER any timestamps or time ranges (do not write things like "0-2s:", "first half", "at
the 3 second mark", etc.).

Write it as one flowing, richly specific passage of natural language — the way a skilled
director would narrate a continuous take to a cinematographer. Use concrete, vivid
production vocabulary throughout: specific camera work, specific lighting, specific
texture/material detail, and specific color and mood. Always choose the most vivid,
concrete word available — never vague or generic language."""


_SCENE_PLAN_OPENING_LONG = """\
You are an award-winning commercial director writing a broadcast television commercial —
the kind that runs in a prime-time break or as a paid social film, and that people actually
remember. Output ONLY the shooting narrative — no preamble, no markdown, no headings, no
shot numbers, and NEVER any timestamps or time ranges (do not write things like "0-2s:",
"first half", "at the 3 second mark", etc.).

Write it as flowing, richly specific natural language — the way a director narrates the
film to a cinematographer and a cast. Use concrete, vivid production vocabulary throughout:
specific camera work, specific lighting, specific texture and material detail, specific
colour and mood. Always choose the most vivid, concrete word available — never vague or
generic language.

THIS IS A STORY, NOT A MONTAGE — THE MOST IMPORTANT RULE HERE. At this length, a sequence
of handsome camera moves around the product is a FAILURE, however beautiful each shot is.
Drifting around a product, pouring it, stirring it, and cutting to a pack shot is product
photography in motion, not an advertisement. A real commercial has someone in it who wants
something, a moment where that want is felt, a turn where the product changes the situation,
and a visibly different state at the end. Write THAT, and let the photography serve it.

CAST THE FILM. Decide on a specific person and commit to them: approximate age, build, hair,
skin tone, wardrobe, and — most importantly — who they are in this moment and what they
want. They must appear as a whole human being with a readable face, not a disembodied pair
of hands. A film in which the only human presence is an anonymous hand entering frame is a
failure. Give them at least one genuine, unmistakable reaction the audience can read: relief,
delight, surprise, quiet pride, recognition.

Adapt the human stake to the category — never force a lifestyle cliché onto something that
does not fit. A consumer product usually has a user; a professional tool has an operator or
the person whose day it rescues; an enterprise or industrial product has the decision-maker,
technician, or team who live with the consequences; a service has the person on the
receiving end of it. If a category genuinely has no human user, follow a process that has
human stakes and show the people at either end of it.

THE BRIEF OUTRANKS EVERY DEFAULT ABOVE. What is written above is the default shape of a
commercial at this length, not a template to impose on every brief. When the brief asks for a
particular treatment or format, follow the brief exactly and drop whichever defaults conflict
with it — a brand that asked for one thing and received another has been badly served, however
well made the result.

In particular: a brief asking for a studio product film, hero product cinematography, a pure
design or craft showcase, a texture or materials study, an abstract or graphic treatment, or
any explicitly product-only piece wants EXACTLY that — light, motion, surface, and detail on
the product itself, on the set it describes. Do not invent a cast, a storyline, or a slice of
life it did not ask for, and do not relocate it out of the studio. A brief asking for a
specific format — testimonial, creator/UGC, unboxing, demonstration, founder-to-camera,
before-and-after — wants the conventions of that format, including its camera, its lighting,
and its way of speaking, even where those are deliberately unpolished.

What still holds no matter the treatment: something must DEVELOP across the film rather than
repeating. In a product-only film the development is the product revealed with rising
intensity — a detail, then the form, then the whole object landing as a hero — with the light,
framing, and energy escalating shot to shot. Four handsome angles of the same static object,
in any order, is still a failure."""


_SCENE_PLAN_CRAFT = f"""\
THE FIRST FRAME IS THE HOOK: social feeds decide in half a second. The very first frame
must already be visually magnetic — motion in progress, a striking detail, a face, light
doing something deliberate. Never open on an empty establishing beat, a blank surface, or
a slow fade-in from nothing; the video starts mid-life, not at rest.

CAMERA MOTION: name at least one deliberate, specific camera move in the narrative — a
slow push-in, an orbital drift, a rack focus pull, a rise or descend, a whip-cut settle,
a handheld drift — rather than implying a static tripod. The camera is a storyteller, not
a security camera; but keep the movement motivated and smooth, never frantic.

SOUND SIGNATURE: the video is generated WITH audio. Include one short clause describing
the ambient/sync sound world — the fizz, the pour, the room tone, the fabric rustle, a
low warm score — folded naturally into the narrative, matching the register of the
concept. Never leave the soundscape unplanned.

Choose the visual style, lighting, mood, and pacing that genuinely fit THIS product/
category and brief — do not default to one fixed "luxury/glamour" look for everything.
For example: a pharmaceutical or health product calls for clinical precision, trustworthy
scientific visualization, and calm reassurance, not perfume-ad glamour or opulent jewelry
lighting. A fragrance or luxury good calls for glamour and opulence. A tech product calls
for clean, minimal, futuristic precision. A food product calls for warm, appetizing,
tactile detail. Infer the right register from the concept below and commit to it fully —
never let one generic "premium cinematic" template override what the concept actually
calls for.

Where the concept describes a specific problem, benefit, or process (e.g. a health
condition, a use case, an emotional pain point), invent one clear visual metaphor that
dramatizes exactly that — grounded in what the concept literally asks for, not a generic
substitute (e.g. if the concept is about a digestive or internal process, show that
process and the product visibly resolving it — do not fall back to a generic "product
floating in a clean studio" shot instead). Ground the metaphor in plausible physical
imagery; never depict impossible effects or make exaggerated, false, or misleading claims
about what the product/service actually does — symbolize the benefit, don't overstate it."""


_PRODUCT_FIDELITY_NOTE = """\
If reference images are provided, every detail of the real subject's appearance, packaging,
logo, typography, colour, and proportions — drawn from ALL of the images provided, not just
one — must be reproduced with total fidelity, never redesigned, simplified, or altered."""


_PRODUCT_PRESENCE_SHORT = f"""\
Always build toward a clear reveal of the product/subject, in whatever register fits its
category and mood, ending on a sharp, well-composed final shot.

{_PRODUCT_FIDELITY_NOTE}"""


_PRODUCT_PRESENCE_LONG = f"""\
THE PRODUCT IS THE LEAD, NOT THE CAMEO. Saving it for a pack shot at the end wastes the
film: a viewer who drops out early never learns what is being sold. It must be clearly
identifiable EARLY — recognisable in the opening stretch, not teased in shadow — present
and doing something through the middle, and held clean and legible at the very end. It is
what the person in the film is actually using, and the story should not work without it.

Show the product being genuinely USED, not merely displayed: opened, applied, worn, poured,
operated, worked with, relied on — whatever real use looks like for this category. The
single most valuable shot in the film is the moment of use landing on a human reaction, and
the film must contain that moment.

Close on an end frame worthy of a broadcast spot: the product hero and unmistakable, its
packaging, label, and brand mark sharp and readable if reference images provide them, the
scene resolved and at rest.

{_PRODUCT_FIDELITY_NOTE}"""


_DIALOGUE_SHORT = """\
DIALOGUE & ON-SCREEN SPEECH: Only include spoken dialogue or on-screen speech if the
concept genuinely calls for it — never invent a line just to have one. When you do include
one, keep it to a single short, natural line — a handful of words, not a full sentence — so
it can be spoken completely and land before the video ends, with clear time left on either
side for the visual setup and the closing/reveal beat. Natural speech runs roughly 2-3
words per second, so a 4-6 second video only has room for a very short phrase (about 3-6
words); even at 8-10 seconds, keep it to one short sentence at most — never a full
paragraph or multiple exchanges. Fold the line into the flowing narrative exactly as a
director would describe it being delivered in the moment (e.g. "...she exhales and says,
'Relief, finally.'") — never introduce it as a separate timed cue (no "at 3 seconds she
says..." phrasing)."""


def _dialogue_direction(duration_seconds: int, num_segments: int) -> str:
    """How much the film may speak, and what the speech has to accomplish.

    The short-form wording is deliberately suppressive — at 10 seconds a spare line is
    usually right. At broadcast lengths that same wording starves the film, so the budget is
    derived from the runtime instead of asserted.
    """
    if num_segments == 1:
        return _DIALOGUE_SHORT
    words, lines = _speech_budget(duration_seconds)
    return f"""\
DIALOGUE — THIS FILM SPEAKS. A {duration_seconds}-second commercial carries real spoken
language, and silence broken only by two slogan fragments is a wasted spot. Natural delivery
runs about 2.5 words per second and roughly half the runtime should carry speech, so budget
about {words} spoken words across the whole film — roughly {lines} lines. Treat that as a
ceiling to write toward, not a quota to pad: every line must earn its place, and the film
still needs to breathe between them.

SPREAD THE SPEECH ACROSS THE WHOLE FILM. This is the rule most often got wrong: a film that
runs silent and then delivers two short lines near the end has NOT written dialogue, it has
written a slogan. Where the film speaks at all, there should be spoken language in the
opening {VIDEO_SEGMENT_SECONDS}-second stretch and in most stretches after it — it talks
throughout, the way a broadcast spot does.

TWO EXCEPTIONS, AND THEY OVERRIDE THE BUDGET. First, if the brief asks for a treatment that
does not speak — a studio product film, an atmospheric or purely visual piece, a music-led
montage, or anything the brief describes without people — then write no dialogue at all and
let sound design and score carry it. Silence chosen on purpose is far stronger than a line
invented to satisfy a quota. When you make that choice, state it outright by ending the block
with the sentence "No dialogue." so the renderer is told explicitly rather than left to infer
it. Second, only give a line to someone physically able to deliver
it in that moment: a person mid-sprint, mid-lift, straining, laughing, eating, underwater, or
across a noisy room cannot speak a considered sentence, and writing one for them reads as
false instantly. Let those stretches play on breath, effort, and sound instead.

Write lines a real person would say out loud, in their own voice — not advertising copy read
aloud. "This is going to be a good day" is dialogue; "Premium quality for the modern
lifestyle" is a slogan pretending to be one. Contractions, hesitations, and plain words are
good.

SERIOUSLY CONSIDER A SECOND CHARACTER. One person alone in a room can only murmur to
themselves or be narrated over; two people can actually talk — a partner, a colleague, a
friend, a child, a customer and whoever serves them. An exchange, even two or three traded
lines, plays far better than a lone character thinking out loud, and far better than a
disembodied narrator. Use one character alone only when the concept truly calls for
solitude.

Across the film the speech should do three jobs: open by pulling the viewer in (a line of
dialogue, a question, something overheard); somewhere in the middle name the real benefit
the way a person would actually describe it, not as a feature list; and close with one
clean, confident line that lands the brand and could be the last thing heard in a TV break.
A brand or product name spoken naturally in the closing line is usually right.

Never write speech that cannot finish. Each spoken line belongs to one continuous
{VIDEO_SEGMENT_SECONDS}-second stretch and must start and finish inside it, with air on
either side — a line running past the end of its stretch gets cut off mid-word. Keep any
single line to roughly {max(4, round(VIDEO_SEGMENT_SECONDS * 0.45 * 2.5))} words or fewer.

Fold every line into the flowing narrative exactly as a director would describe it being
delivered in the moment (e.g. "...she exhales, half laughing, and says, 'Finally.'") — never
as a separate timed cue, a script block, or a "VO:" label."""


_SCENE_PLAN_RULES = f"""\
Rules:
- The FINISHED VIDEO must feel like a complete, self-contained piece with a clear
  beginning, a middle development, and a deliberate closing beat that resolves the action
  (a settle, a hold, a button moment, dialogue reaching its final line). It must never end
  mid-action, mid-sentence, or feel cut off, whatever its target duration. When the video
  is planned as several consecutive segments, this applies to the arc as a whole — only
  the FINAL segment carries that closing beat, and every earlier one deliberately does not.
- If the aspect ratio is 9:16 (vertical), compose for vertical viewing: keep the subject
  and key action in the middle band of the frame, with clean headroom at the top and
  bottom thirds where platform UI (captions, buttons) overlays — never place critical
  detail at the extreme top or bottom edge.
- Any dialogue or on-screen speech must be short enough to finish completely and
  naturally within the runtime — never trail off, get cut short, or leave a line
  unfinished.
- Keep continuity — the subject, setting, and style stay consistent throughout unless the
  concept explicitly calls for a scene change.
- End your description — each segment block separately, when the plan is split into
  segments — with one final line starting with "Style:" listing comma-separated
  production/technical descriptors that match THIS concept's actual category and mood (not
  a fixed luxury template) — e.g. clinical and trustworthy medical visualization for a
  health product, or hyper-realistic glamour lighting for a fragrance — plus any fidelity
  constraints that apply (e.g. preserve every logo, color, texture, and design element
  exactly as provided, across all reference images; no misleading or exaggerated claims).

{_TEXT_ACCURACY_GUARDRAIL}
"""


_SCENE_PLAN_IMAGE_NOTE = f"""
You are given one or more reference images of the actual product/subject, optionally from
different angles. Ground every part of the narrative in exactly what you see — across ALL
of the images provided, not just the first one — and do not invent or guess at details
none of the images clearly show.

{_PRODUCT_FIDELITY_GUARDRAIL}
"""


def _build_scene_plan_system(
    duration_seconds: int, num_segments: int, with_images: bool = False
) -> str:
    """Assemble the narrative planner's system prompt for this runtime.

    A ten-second spot and a forty-second spot are different crafts, not the same craft at
    two lengths. Short form keeps the proven single-continuous-take direction; anything
    longer is briefed as a scripted television commercial — cast, story turn, and a real
    speaking budget — because at broadcast length the short-form wording reliably produces
    a handsome product montage with two slogan fragments instead of an advertisement.
    """
    opening = _SCENE_PLAN_OPENING_SHORT if num_segments == 1 else _SCENE_PLAN_OPENING_LONG
    presence = _PRODUCT_PRESENCE_SHORT if num_segments == 1 else _PRODUCT_PRESENCE_LONG
    parts = [
        opening,
        _SCENE_PLAN_CRAFT,
        presence,
        _dialogue_direction(duration_seconds, num_segments),
        _SCENE_PLAN_RULES,
    ]
    system = "\n\n".join(parts)
    if with_images:
        system += _SCENE_PLAN_IMAGE_NOTE
    return system

_STORYBOARD_ARC_SINGLE = """\
Beat 1 (hook): an opening that earns attention — an intriguing detail, an establishing shot of the
setting, or the anticipation just before the moment (a hand reaching in, a plate being set down,
an ingredient in motion). Beats 2-3 (build/context): the world around the product comes alive —
the setting, the person, the desire or problem the product answers, each beat advancing the story.
Beats 4-5 (escalation/process): the process, service, or interaction that builds toward the
payoff — a chef finishing a plate, a server presenting it, someone reaching for it, the product
being prepared or revealed step by step. Beat 6 (hero/product moment): the product's defining
moment, usually the instant a person engages with it directly — taking a bite, pouring, applying,
unboxing — shown with total clarity. Beats 7-8 (payoff/reaction): the emotional payoff unfolding —
a satisfied reaction, a genuine smile, a close-up of pure enjoyment, the result of using the
product visible in the person or the scene. Beat 9 (closing/CTA): a calm, resolved final frame —
a clean settled hero shot of the product (with logo/packaging clearly readable if provided), the
scene at rest — the frame the video will hold on as it ends, never mid-action."""


def _storyboard_arc(total_beats: int, num_segments: int) -> str:
    """The beat-by-beat arc spec. One segment keeps the proven nine-beat wording; longer
    videos get the same shape stretched proportionally over 9 beats per segment, with the
    resolution held back to the very last beat."""
    if num_segments == 1:
        return _STORYBOARD_ARC_SINGLE

    hook_end = max(1, round(total_beats * 0.08))
    build_end = round(total_beats * 0.33)
    escalate_end = round(total_beats * 0.62)
    hero_end = round(total_beats * 0.72)
    payoff_end = total_beats - 1
    return (
        f"Spread ONE advertisement's arc across all {total_beats} beats — this is a single "
        f"{total_beats * VIDEO_SEGMENT_SECONDS // BEATS_PER_SEGMENT}-second commercial, not "
        f"{num_segments} short ones stitched together.\n\n"
        f"Beat 1 to {hook_end} (hook): an opening that earns attention — an intriguing detail, an "
        f"establishing shot of the setting, or the anticipation just before the moment (a hand "
        f"reaching in, a plate being set down, an ingredient in motion).\n"
        f"Beats {hook_end + 1}-{build_end} (build/context): the world around the product comes "
        f"alive — the setting, the person, the desire or problem the product answers, each beat "
        f"advancing the story.\n"
        f"Beats {build_end + 1}-{escalate_end} (escalation/process): the process, service, or "
        f"interaction that builds toward the payoff — a chef finishing a plate, a server "
        f"presenting it, someone reaching for it, the product prepared or revealed step by step.\n"
        f"Beats {escalate_end + 1}-{hero_end} (hero/product moment): the product's defining "
        f"moment, usually the instant a person engages with it directly — taking a bite, pouring, "
        f"applying, unboxing — shown with total clarity.\n"
        f"Beats {hero_end + 1}-{payoff_end} (payoff/reaction): the emotional payoff unfolding — a "
        f"satisfied reaction, a genuine smile, a close-up of pure enjoyment, the result of using "
        f"the product visible in the person or the scene.\n"
        f"Beat {total_beats} (closing/CTA): a calm, resolved final frame — a clean settled hero "
        f"shot of the product (with logo/packaging clearly readable if provided), the scene at "
        f"rest — the frame the video will hold on as it ends, never mid-action.\n\n"
        f"The beats are rendered in groups of {BEATS_PER_SEGMENT}: beats 1-{BEATS_PER_SEGMENT} "
        f"are the first {VIDEO_SEGMENT_SECONDS}-second shot, the next {BEATS_PER_SEGMENT} are the "
        f"second, and so on. So every {BEATS_PER_SEGMENT}th beat hands off to the next shot: it "
        f"must sit mid-development, with the action still unfolding, never on a resolved or "
        f"settled-looking frame. Beat {total_beats} is the ONLY resolved frame in the whole "
        f"storyboard."
    )


def _continuity_block_instruction(num_segments: int) -> str:
    """Multi-sheet storyboards are drawn as independent images (feeding a rendered sheet back
    in as a reference makes the image model refuse outright), so the cast has to be pinned in
    words that every sheet prompt repeats verbatim."""
    if num_segments == 1:
        return ""
    return (
        'Before the beats, output ONE extra block: a line starting with "CONTINUITY:" that '
        "fixes what must not change from sheet to sheet — the recurring person (approximate "
        "age, hair colour and length, skin tone, build), their wardrobe, the location, the "
        "time of day, and the colour grade. Write it so two different artists reading only "
        "that line would draw the same person. Separate it from the first beat with the same "
        "three-dash line.\n\n"
    )


def _build_storyboard_system(total_beats: int, num_segments: int) -> str:
    return f"""\
You are an award-winning commercial director breaking a short video concept into a {total_beats}-beat
storyboard for a real advertisement — the kind that runs on TV or social, not a set of product
photography variations. A storyboard where every panel is just another angle on the same static
plate/bottle/box is a FAILURE, no matter how well-lit. Real ads sell a feeling: they put a person
in the frame — reaching for the product, preparing it, tasting it, reacting to it — because
audiences connect with a moment, not a still life.

{_storyboard_arc(total_beats, num_segments)}

For food, drink, hospitality, beauty, or any product meant to be used on or by a person, several
beats — especially the hero and payoff beats — MUST show a real person genuinely interacting with it (eating,
drinking, holding, applying, wearing) in a believable setting (e.g. a restaurant table, a kitchen,
a bathroom counter) — do not default to nine variations of the product sitting alone on a surface.
Only skip the human moments if the category genuinely doesn't call for them (e.g. an industrial
part, enterprise software). If a person appears in more than one beat, keep them the same person
across those beats for narrative continuity.

Each beat is one still frame a storyboard artist could draw — describe it as a single vivid,
concrete visual: framing/camera angle, who or what is in frame and what they're doing, the
setting, and mood/lighting. Describe a frozen moment, not a shot with camera movement or duration.
Keep each beat's paragraph SHORT — 1-2 tight sentences — since there are {total_beats} of them.
Vary the framing and setting meaningfully across the {total_beats} beats — do not repeat the same
composition, angle, or crop with only minor changes.

Match the register the concept actually calls for (clinical precision for a health product, warm
tactile detail for food, glamour for fragrance/luxury, clean futurism for tech, etc.) — never
default to one fixed "premium cinematic" look for everything.

If reference images of the real product are provided, the product itself must be reproduced
exactly as shown in them — same shape, color, materials, proportions, logo, and packaging — in
every beat where it appears. Never redesign or reimagine the product. This fidelity requirement is
about the product only — it does not mean every beat must be a repeat product shot; people, hands,
settings, and framing should still change beat to beat to tell a real story.

{_continuity_block_instruction(num_segments)}Output EXACTLY {total_beats} beats. Write each beat as one paragraph. Separate the {total_beats}
paragraphs with a line containing only three dashes (---) and nothing else. Do not number the
beats, and do not add headings, labels, or any text other than the {total_beats} beat paragraphs
and the dash separators.

{_PRODUCT_FIDELITY_GUARDRAIL}
"""

_STORYBOARD_MATCH_INSTRUCTION = (
    "This storyboard image and the beats below are the APPROVED plan for this video — do not "
    "invent a different concept, setting, or product treatment. Write ONE continuous cinematic "
    "narrative (no timestamps, no shot labels) that flows through these beats in this exact "
    "order, using the same product, styling, setting, and mood shown in the storyboard image. "
    "The beats are the narrative arc, not equal timed slots — early and middle beats may pass "
    "quickly, but the FINAL beat must be given generous room: all action resolves before the "
    "end, and the video closes by settling and holding on that final resolved frame in complete "
    "stillness, so it ends deliberately rather than feeling cut off mid-motion."
)

# Mirrors the wording used for logo compositing in image generation (core/image_gen.py) —
# same "mandatory, faithful reproduction, corner placement" pattern, adapted for video.
_LOGO_INSTRUCTION = (
    "MANDATORY: The LAST reference image provided is the brand logo. You MUST include it "
    "in the video — its absence is a failure. Reproduce it with EXACT accuracy: identical "
    "shape, colors, and proportions — do not simplify, redraw, or reinterpret it. If the logo "
    "contains any text, reproduce every character exactly as shown; a misspelled or altered "
    "logo is a failure, not a stylistic variation. Composite it as a subtle corner watermark "
    "(bottom-right preferred), occupying roughly 8-12% of the frame width and unmistakably "
    "readable by the time the video closes. It must never obscure or compete with the main "
    "subject."
)

# Extensions are sent no images, so the logo has to be described as already on screen.
_LOGO_INSTRUCTION_CONTINUED = (
    "MANDATORY: Keep the brand logo watermark exactly as it already appears in the footage — "
    "same corner, same size, same colors, same spelling — for the whole of this segment. Do "
    "not drop it, move it, resize it, redraw it, or let it drift; it is the same composited "
    "mark, unchanged."
)


def build_video_prompt(
    prompt: str,
    platform: str,
    brand_kit: BrandKit | None = None,
) -> str:
    """Enrich a raw user prompt with brand voice/tone context for text-to-video generation."""
    tone = get_platform_tone(brand_kit, platform) if brand_kit else None
    parts = [
        "Professional short-form commercial video. Camera work, lighting, and mood should "
        "match the product category and concept described below — not a fixed template.",
        f"Scene: {prompt}",
    ]
    if tone:
        parts.append(f"Tone and mood: {tone}.")
    if brand_kit and brand_kit.brand_voice:
        parts.append(f"Brand voice: {brand_kit.brand_voice}.")
    return " ".join(parts)


def add_logo_instruction(segment_prompts: list[str]) -> list[str]:
    """Append the mandatory logo-compositing instruction to every segment of a video plan.
    Call this only when a logo image is being appended as the LAST entry in the images
    list. Only the opening segment is sent the image itself, so later segments are told to
    carry forward the watermark already established rather than to look for a reference."""
    return [
        f"{p}\n\n{_LOGO_INSTRUCTION if i == 0 else _LOGO_INSTRUCTION_CONTINUED}"
        for i, p in enumerate(segment_prompts)
    ]


def add_product_fidelity_guardrail(segment_prompts: list[str]) -> list[str]:
    """Append the mandatory product-fidelity instruction to every segment of a video plan.
    Call this whenever real product reference images are included in the images list."""
    return [
        f"{p}\n\n{_PRODUCT_FIDELITY_GUARDRAIL if i == 0 else _PRODUCT_FIDELITY_CONTINUED}"
        for i, p in enumerate(segment_prompts)
    ]


def build_segment_prompts(concept: str, narratives: list[str]) -> list[str]:
    """Prefix each planned segment narrative with the concept to make the prompt actually sent
    to the video model. Kept separate from planning so a narrative can be shown to the user,
    handed back on the follow-up request, and rendered without being re-planned."""
    return [f"{concept}\n\n{n.strip()}" for n in narratives]


def _build_duration_instruction(duration_seconds: int, num_segments: int) -> str:
    """The timing contract handed to the narrative planner.

    One segment = the old single-narrative behaviour. More than one = the video is
    rendered as consecutive 10-second extensions, so the planner must split the arc into
    blocks that hand off cleanly and place the resolution in the last one.
    """
    if num_segments == 1:
        return (
            f"This video will run for exactly {duration_seconds} seconds — write a narrative "
            f"that naturally fills that time and reaches a satisfying, resolved conclusion "
            f"BEFORE the end — all action and dialogue finish with time to spare, and the video "
            f"closes on a held, settled final frame rather than cutting off mid-motion. Do not "
            f"mention seconds, timestamps, or any timing markers anywhere in your description."
        )
    return (
        f"This video runs for exactly {duration_seconds} seconds and is rendered as "
        f"{num_segments} consecutive {VIDEO_SEGMENT_SECONDS}-second segments: an opening shot, "
        f"then {num_segments - 1} extensions that each continue the previous footage from its "
        f"final frame. Plan ONE story that spans the full {duration_seconds} seconds, then "
        f"write it out as exactly {num_segments} blocks — one per segment, in order — "
        f"separated by a line containing only three dashes (---) and nothing else.\n\n"
        f"Pace a STORY across the segments, not a series of angles: segment 1 opens on the "
        f"person and their situation and establishes what they want or what is in their way; "
        f"the middle segments bring the product in and let it visibly change that situation, "
        f"shown through use and reaction rather than description; segment {num_segments} pays "
        f"it off — the person visibly better off than they started — and closes on the product "
        f"held clean and legible. If nothing has changed for anyone between segment 1 and "
        f"segment {num_segments}, the film has no story and must be rewritten.\n\n"
        f"Every segment except the last must END IN MOTION — mid-gesture, mid-move, on a beat "
        f"that visibly wants the next moment. Never let a non-final segment settle, hold, fade, "
        f"come to rest, land on a composed 'final' frame, or finish a line of dialogue on its "
        f"last beat: another {VIDEO_SEGMENT_SECONDS} seconds follows immediately and must pick "
        f"up without a seam. Segment {num_segments} is the only one that resolves — its action "
        f"and dialogue all finish with time to spare and it closes on a held, settled frame.\n\n"
        f"Each block is read on its own by a model that can see the preceding footage but not "
        f"the other blocks. So open every block with a short clause naming the subject, "
        f"setting, and look before describing the new action — continuity must never depend on "
        f"the other blocks' wording. Each block covers only "
        f"{VIDEO_SEGMENT_SECONDS} seconds of screen time: one or two developments, not a whole "
        f"story.\n\n"
        f"Because every block is read on its own, the recurring person must be re-described in "
        f"the SAME concrete terms every time they appear — age, build, hair, skin tone, "
        f"wardrobe. A block that says only \"she\" or \"the woman\" will be cast as a different "
        f"person and the film will visibly change actor mid-scene.\n\n"
        f"Unless the concept genuinely calls for silence, EVERY block should carry at least one "
        f"spoken line, including the first — do not save all the talking for the final block. "
        f"Each line must begin and finish inside its own block.\n\n"
        f"Do not mention seconds, timestamps, segment numbers, or any timing markers inside the "
        f"blocks themselves."
    )


def _split_segments(raw: str, num_segments: int) -> list[str]:
    """Split a planner response into exactly `num_segments` segment prompts.

    Falls back to blank-line splitting, then to repeating what we got, so a planner that
    ignores the separator still yields a renderable plan rather than a 502.
    """
    text = raw.strip()
    if num_segments == 1:
        return [text]

    blocks = [b.strip() for b in text.split("---") if b.strip()]
    if len(blocks) != num_segments:
        blocks = [b.strip() for b in text.split("\n\n") if b.strip()]
    if not blocks:
        blocks = [text]
    if len(blocks) < num_segments:
        logger.warning(
            "video segment plan came back short | got=%d want=%d", len(blocks), num_segments
        )
        blocks = blocks + [blocks[-1]] * (num_segments - len(blocks))
    return blocks[:num_segments]


async def plan_video_scenes(
    llm: LLMClient,
    concept: str,
    duration_seconds: int,
    aspect_ratio: str,
    platform: str,
) -> list[str]:
    """Turn a video concept into one continuous natural-language narrative (no
    timestamps or shot labels) so the generated video fills the full target duration
    with a deliberate ending instead of cutting off abruptly.

    Returns one narrative per 10-second render segment — a single-element list for a 10s
    video, four for a 40s one. Wrap with build_segment_prompts() before rendering."""
    num_segments = segments_for(duration_seconds)
    prompt = (
        f"Video concept: {concept}\n"
        f"{_build_duration_instruction(duration_seconds, num_segments)}\n"
        f"Aspect ratio: {aspect_ratio}. Platform: {platform}."
    )
    narrative = await llm.complete(
        *GEMINI_FLASH,
        system=_build_scene_plan_system(duration_seconds, num_segments),
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        max_tokens=1000 * num_segments,
    )
    return _split_segments(narrative, num_segments)


async def plan_video_scenes_with_images(
    llm: LLMClient,
    concept: str,
    images: list[tuple[bytes, str]],
    duration_seconds: int,
    aspect_ratio: str,
    platform: str,
) -> list[str]:
    """Same as plan_video_scenes, but grounds the narrative in one or more reference
    images (e.g. product photos from different angles) so the description matches the
    real subject, not a guessed one. Do not pass the brand logo here — this is for the
    product/subject references only; logo compositing is handled separately."""
    num_segments = segments_for(duration_seconds)
    prompt = (
        f"Video concept: {concept}\n"
        f"{_build_duration_instruction(duration_seconds, num_segments)}\n"
        f"Aspect ratio: {aspect_ratio}. Platform: {platform}."
    )
    full_prompt = f"{_build_scene_plan_system(duration_seconds, num_segments, with_images=True)}\n\n{prompt}"
    if len(images) == 1:
        narrative = await llm.complete_with_vision(
            file_bytes=images[0][0],
            prompt=full_prompt,
            mime_type=images[0][1],
        )
    else:
        narrative = await llm.complete_with_vision_multi(files=images, prompt=full_prompt)
    return _split_segments(narrative, num_segments)


async def plan_storyboard_beats(
    llm: LLMClient,
    concept: str,
    images: list[tuple[bytes, str]],
    duration_seconds: int,
    aspect_ratio: str,
    platform: str,
) -> tuple[str, list[str]]:
    """Break a campaign video concept into storyboard beats (hook, build, escalation,
    hero/product moment, payoff, closing/CTA), grounded in the product reference images so
    the storyboard image and the later video narrative both depict the same real product.

    Returns (continuity, beats). `continuity` is a cast/wardrobe/location lock repeated into
    every sheet prompt so independently drawn sheets show the same person; it is empty for
    single-sheet storyboards, which have nothing to stay consistent with.

    Returns 9 beats per 10-second segment, flat and in story order — 9 for a 10s video, 36
    for a 40s one."""
    num_segments = segments_for(duration_seconds)
    total_beats = BEATS_PER_SEGMENT * num_segments
    system = _build_storyboard_system(total_beats, num_segments)
    prompt = (
        f"Video concept: {concept}\n"
        f"This video will run for exactly {duration_seconds} seconds, flowing through these "
        f"{total_beats} beats in order — pace each beat's content accordingly, with the final "
        f"beat as a held, resolved closing frame.\n"
        f"Aspect ratio: {aspect_ratio}. Platform: {platform}."
    )
    full_prompt = f"{system}\n\n{prompt}"
    if images:
        if len(images) == 1:
            raw = await llm.complete_with_vision(file_bytes=images[0][0], prompt=full_prompt, mime_type=images[0][1])
        else:
            raw = await llm.complete_with_vision_multi(files=images, prompt=full_prompt)
    else:
        raw = await llm.complete(
            *GEMINI_FLASH,
            system=system,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=200 * total_beats,
        )

    beats = [b.strip() for b in raw.split("---") if b.strip()]
    if len(beats) not in (total_beats, total_beats + 1):
        beats = [b.strip() for b in raw.split("\n\n") if b.strip()]
    if not beats:
        beats = [raw.strip()]

    # The optional leading CONTINUITY block pins the cast across independently drawn sheets.
    continuity = ""
    if beats and beats[0].upper().startswith("CONTINUITY:"):
        continuity = beats.pop(0).split(":", 1)[1].strip()

    if len(beats) < total_beats:
        logger.warning(
            "storyboard beats came back short | got=%d want=%d", len(beats), total_beats
        )
        beats = beats + [beats[-1]] * (total_beats - len(beats))
    return continuity, beats[:total_beats]


def _build_storyboard_image_prompt(
    beats: list[str],
    concept: str,
    num_product_images: int,
    video_aspect_ratio: str,
    sheet_index: int = 0,
    sheet_count: int = 1,
    previous_sheet_last_beat: str | None = None,
    continuity: str = "",
) -> str:
    rows = math.ceil(len(beats) / 3)
    row_labels = (
        ["top", "middle", "bottom"] if rows == 3
        else ["top", "bottom"] if rows == 2
        else [f"row {i + 1}" for i in range(rows)]
    )
    panel_labels = [
        f"{row_labels[i // 3]}-{['left', 'center', 'right'][i % 3]}" for i in range(len(beats))
    ]
    panel_lines = "\n".join(
        f"Panel {i + 1} ({panel_labels[i]}): {beat}" for i, beat in enumerate(beats)
    )
    sheet_note = ""
    if sheet_count > 1:
        first = sheet_index * BEATS_PER_SEGMENT + 1
        last = first + len(beats) - 1
        sheet_note = (
            f"\n\nThis is sheet {sheet_index + 1} of {sheet_count} for one continuous "
            f"commercial — it covers beats {first}-{last} of "
            f"{BEATS_PER_SEGMENT * sheet_count}, the "
            f"{'opening' if sheet_index == 0 else 'closing' if sheet_index == sheet_count - 1 else 'middle'}"
            f" stretch. Draw only these 9 beats, but treat the styling as part of the whole "
            f"film: identical product, characters, wardrobe, location, lighting, and colour "
            f"grade as the rest of the commercial."
        )
        # Continuity is carried as TEXT, never by feeding a rendered sheet back in: the
        # image model returns IMAGE_OTHER (no image at all) when a 9-panel storyboard collage
        # is supplied as a reference, so sheets are drawn independently from the shared
        # concept, the product photos, and the handoff beat below.
        if continuity:
            sheet_note += (
                f" CAST AND SETTING LOCK — identical on every sheet of this commercial, follow "
                f"it exactly: {continuity}"
            )
        if previous_sheet_last_beat:
            sheet_note += (
                f" The previous sheet ended on this beat: \"{previous_sheet_last_beat}\" — open "
                f"this sheet from that exact moment, same person, wardrobe, location, and light, "
                f"so the two sheets read as one continuous film."
            )
    n = len(beats)
    return (
        "Generate ONE single image only: a square storyboard collage on a plain neutral "
        f"background, divided into EXACTLY {n} equal panels — {rows} rows of 3 columns — by thin "
        "clean divider lines, like a film director's storyboard sheet. The grid must contain "
        f"exactly {n} panels: never add an extra row or column, never repeat a panel, and never "
        "leave a panel empty. Each panel is a separate, self-contained illustration of "
        "one beat of the same commercial — same product, same characters, same overall visual "
        f"style and color grade across all {n} panels (each panel depicts one frame of a "
        f"{video_aspect_ratio} video), just a different pose, angle, or moment in "
        "each. Panels read left-to-right, top-to-bottom in story order, one panel per beat "
        f"below — {n} beats, {n} panels. Do not add any text, "
        f"captions, numbers, or labels inside the image — the {n} panels alone tell the story.\n\n"
        f"{panel_lines}\n\n"
        f"Overall concept for continuity: {concept}{sheet_note}\n\n"
        f"{product_identity_instructions(num_product_images)}"
    )


async def generate_video_storyboard(
    llm: LLMClient,
    concept: str,
    product_images: list[tuple[bytes, str]],
    duration_seconds: int,
    aspect_ratio: str,
    platform: str,
    logo_image: tuple[bytes, str] | None = None,
) -> tuple[list[str], list[str]]:
    """Generate one 3x3-grid storyboard collage image per 10-second segment (one panel per
    beat) plus the beat descriptions used to plan them, so the beats can be reused afterward
    to keep the actual video narrative in sync with what the storyboard shows.

    Returns (storyboard_images_base64, beats) — N sheets and 9xN beats, both in story order.
    All sheets are drawn in parallel from the same concept, the same product photos, and the
    beat their predecessor ended on, which is what keeps four sheets reading as one film."""
    num_segments = segments_for(duration_seconds)
    continuity, beats = await plan_storyboard_beats(
        llm, concept, product_images, duration_seconds, aspect_ratio, platform
    )

    product_bytes = [b for b, _ in product_images]
    logo_note = (
        "\n\nMANDATORY: The LAST reference image is the brand logo. Composite it as a small "
        "corner watermark in every panel, reproduced with exact accuracy — do not simplify or "
        "redraw it."
    )

    async def _sheet(index: int) -> str:
        sheet_beats = beats[index * BEATS_PER_SEGMENT : (index + 1) * BEATS_PER_SEGMENT]
        image_prompt = _build_storyboard_image_prompt(
            sheet_beats, concept, len(product_images), aspect_ratio,
            sheet_index=index, sheet_count=num_segments,
            previous_sheet_last_beat=beats[index * BEATS_PER_SEGMENT - 1] if index else None,
            continuity=continuity,
        )
        images = list(product_bytes)
        # The logo has to stay LAST so the "last reference image" wording holds.
        if logo_image:
            images.append(logo_image[0])
            image_prompt += logo_note
        # The collage sheet is always rendered square: on a non-square canvas (e.g. 9:16) the
        # image model pads the 3x3 grid with extra rows of duplicate panels to fill the page.
        # The video's aspect ratio is conveyed per-panel inside the prompt instead.
        last_err: Exception | None = None
        for attempt in range(2):
            try:
                return await llm.generate_image_with_image_bytes(image_prompt, images, aspect_ratio="1:1")
            except Exception as exc:
                last_err = exc
                logger.warning(
                    "storyboard sheet %d/%d attempt %d failed | %s",
                    index + 1, num_segments, attempt + 1, exc,
                )
        logger.error(
            "image_pipeline_degraded=storyboard_sheet | sheet %d/%d failed after retry | reason=%s",
            index + 1, num_segments, last_err,
        )
        raise last_err  # type: ignore[misc]

    sheets = await asyncio.gather(*[_sheet(i) for i in range(num_segments)])
    return list(sheets), beats


async def plan_video_scenes_from_storyboard(
    llm: LLMClient,
    concept: str,
    beats: list[str],
    storyboard_images: list[tuple[bytes, str]],
    product_images: list[tuple[bytes, str]],
    duration_seconds: int,
    aspect_ratio: str,
    platform: str,
) -> list[str]:
    """Same as plan_video_scenes_with_images, but anchors the narrative to an already-generated
    storyboard (sheets + beats) instead of freely reinventing one, so the final video visually
    and narratively matches what the user saw in the storyboard step.

    Beats are grouped 9 per segment in story order, and each segment's narrative is written
    from its own group so segment k renders the beats the user approved for segment k."""
    num_segments = segments_for(duration_seconds)
    if num_segments > 1:
        beats_block = "\n\n".join(
            "\n".join(
                f"Beat {i + 1}: {b}"
                for i, b in list(enumerate(beats))[
                    seg * BEATS_PER_SEGMENT : (seg + 1) * BEATS_PER_SEGMENT
                ]
            )
            for seg in range(num_segments)
        )
        beats_block = (
            f"The {len(beats)} approved beats, in order — beats 1-{BEATS_PER_SEGMENT} are "
            f"segment 1, the next {BEATS_PER_SEGMENT} are segment 2, and so on, one storyboard "
            f"sheet per segment in the same order:\n\n{beats_block}"
        )
    else:
        beats_block = "\n".join(f"Beat {i + 1}: {b}" for i, b in enumerate(beats))
    prompt = (
        f"Video concept: {concept}\n\n"
        f"{_STORYBOARD_MATCH_INSTRUCTION}\n\n"
        f"{beats_block}\n\n"
        f"{_build_duration_instruction(duration_seconds, num_segments)}\n"
        f"Aspect ratio: {aspect_ratio}. Platform: {platform}."
    )
    full_prompt = f"{_build_scene_plan_system(duration_seconds, num_segments, with_images=True)}\n\n{prompt}"
    narrative = await llm.complete_with_vision_multi(
        files=storyboard_images + product_images, prompt=full_prompt
    )
    return _split_segments(narrative, num_segments)


async def generate_maya_video(
    llm: LLMClient,
    segment_prompts: list[str],
    images: list[tuple[bytes, str]] | None = None,
    aspect_ratio: str = "16:9",
) -> VideoResult:
    """Call Gemini Omni and wrap the result as a VideoResult (base64-encoded, ready for the
    API response). One prompt per 10-second segment; the clip runs 10s x len(segment_prompts).

    The ending guardrail goes on the LAST segment only — that is the one that has to resolve.
    Every earlier segment gets the opposite instruction, so it hands off mid-motion and the
    extension picks up without a seam."""
    final_prompts: list[str] = []
    for index, segment_prompt in enumerate(segment_prompts):
        is_final = index == len(segment_prompts) - 1
        # Applied directly to the final generation prompt (not just the planning-stage system
        # prompt) so the model that actually renders the video sees the hard constraints too.
        final_prompts.append(
            f"{segment_prompt}\n\n{_TEXT_ACCURACY_GUARDRAIL}\n\n"
            f"{_ENDING_GUARDRAIL if is_final else _CONTINUATION_GUARDRAIL}"
        )

    video_bytes = await llm.generate_video(
        segment_prompts=final_prompts,
        images=images,
        aspect_ratio=aspect_ratio,
    )
    return VideoResult(
        video_base64=base64.b64encode(video_bytes).decode(),
        content_type="video/mp4",
        # Return the prompts actually sent to the model (incl. guardrails) so
        # before/after debugging sees the real input, not a truncated one.
        prompt_used="\n\n--- SEGMENT BREAK ---\n\n".join(final_prompts),
    )


# ── Logo Animation (docs/MAYA_LOGO_ANIMATION.md) ────────────────────────────
# 102 hardcoded styles — no LLM planning step, unlike the campaign/storyboard
# flows above. style_id is the 1-based position in LOGO_STYLE_DATA, stable
# across releases since the frontend dropdown references styles by id.

LOGO_ANIMATION_STYLES: list[dict] = [
    {"id": i + 1, "name": name, "category": category}
    for i, (category, name, _prompt) in enumerate(LOGO_STYLE_DATA)
]

_LOGO_ANIMATION_PROMPTS: dict[int, str] = {
    i + 1: prompt for i, (_category, _name, prompt) in enumerate(LOGO_STYLE_DATA)
}

_LOGO_ANIM_FIDELITY_GUARDRAIL = (
    "LOGO FIDELITY — NON-NEGOTIABLE: The uploaded reference image is the ONLY subject of "
    "this video. Every frame builds toward, or already shows, that exact logo: identical "
    "shape, colors, and proportions. Do not redesign, restyle, simplify, or reinterpret it. "
    "If the logo contains text, every character must be spelled exactly as shown and fully "
    "legible at the moment the logo completes — a misspelled or altered logo is a failure, "
    "not a stylistic variation."
)

_LOGO_ANIM_ENDING_GUARDRAIL = (
    "ENDING — NON-NEGOTIABLE: By roughly the final 1.5-2 seconds, the logo is fully formed, "
    "centered, sharp, and at rest — camera settled, no new motion beginning. This final hold "
    "is a clean frame a viewer could pause on and immediately screenshot; never end "
    "mid-formation or mid-motion."
)

_LOGO_ANIM_ASPECT_NOTE = {
    "9:16": (
        "Compose for vertical viewing: keep the logo centered in the middle band of the "
        "frame with generous clean space above and below for platform UI overlays."
    ),
    "16:9": (
        "Compose for widescreen viewing: center the logo with balanced negative space on "
        "both sides, filling the frame with the surrounding scene/effect rather than empty bars."
    ),
}


def build_logo_animation_prompt(style_id: int, aspect_ratio: str) -> tuple[str, str]:
    """Return (final_prompt, style_name) for a hardcoded logo-animation style.

    Raises ValueError if style_id is out of range — callers should turn that into a 400.
    """
    core_action = _LOGO_ANIMATION_PROMPTS.get(style_id)
    if core_action is None:
        raise ValueError(f"Unknown logo animation style_id: {style_id}")
    style_name = LOGO_ANIMATION_STYLES[style_id - 1]["name"]
    aspect_note = _LOGO_ANIM_ASPECT_NOTE.get(aspect_ratio, _LOGO_ANIM_ASPECT_NOTE["9:16"])
    final_prompt = "\n\n".join([
        core_action, _LOGO_ANIM_FIDELITY_GUARDRAIL, _LOGO_ANIM_ENDING_GUARDRAIL, aspect_note,
    ])
    return final_prompt, style_name
