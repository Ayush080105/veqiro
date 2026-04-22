'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { authClient } from '@/lib/auth-client';
import { getBrandKit, saveBrandKit } from '@/lib/api/brain';
import { createOrganization, setActiveOrganization, slugify } from '@/lib/api/organizations';
import Logo from '@/components/logo';
import type { BrandKit } from '@/lib/types';
import {
  FONT,
  Sticker,
  Button,
  FieldLabel,
  VqInput,
  VqTextarea,
} from '@/components/veqiro/shared';

const INDUSTRIES = [
  'SaaS', 'E-commerce', 'Fintech', 'Healthcare', 'Education',
  'Media', 'Agency', 'Consumer app', 'Hardware', 'Nonprofit', 'Other',
];
const VOICES = [
  { v: 'Playful', d: 'puns, emojis, loose' },
  { v: 'Bold', d: 'sharp, confident, short' },
  { v: 'Warm', d: 'human, empathetic, cozy' },
  { v: 'Professional', d: 'crisp, formal, clean' },
  { v: 'Witty', d: 'clever, dry, observant' },
  { v: 'Rebellious', d: 'loud, opinionated, punk' },
];
const PRESET_PALETTES: [string, string, string][] = [
  ['#F06464', '#111111', '#EFE7D6'],
  ['#1DBC87', '#0E5C3F', '#FFF9ED'],
  ['#6FCDE8', '#111111', '#FFE37A'],
  ['#F79FD4', '#8A8AF0', '#111111'],
  ['#F5C518', '#F06464', '#111111'],
];

// Onboarding-local kit: array form for easier preset swaps, comma-separated competitors.
interface OnboardingKit {
  company_name: string;
  company_description: string;
  industry: string;
  target_audience: string;
  brand_voice: string;
  logo_url: string;
  mascot_url: string;
  brand_colors: [string, string, string];
  competitors: string;
  key_differentiators: string;
  website_url: string;
}

const DEFAULT_KIT: OnboardingKit = {
  company_name: '',
  company_description: '',
  industry: '',
  target_audience: '',
  brand_voice: '',
  logo_url: '',
  mascot_url: '',
  brand_colors: ['#F06464', '#111111', '#EFE7D6'],
  competitors: '',
  key_differentiators: '',
  website_url: '',
};

const DRAFT_KEY = 'veqiro.brandKitDraft';

function toBrandKit(k: OnboardingKit): Partial<BrandKit> {
  return {
    company_name: k.company_name,
    company_description: k.company_description,
    industry: k.industry,
    target_audience: k.target_audience,
    brand_voice: k.brand_voice,
    logo_url: k.logo_url || null,
    mascot_url: k.mascot_url || null,
    brand_colors: {
      primary: k.brand_colors[0],
      secondary: k.brand_colors[1],
      accent: k.brand_colors[2],
    },
    platform_tones: { twitter: '', linkedin: '', instagram: '' },
    competitors: k.competitors
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    key_differentiators: k.key_differentiators,
    website_url: k.website_url,
  };
}

function fromBrandKit(k: BrandKit): OnboardingKit {
  return {
    company_name: k.company_name ?? '',
    company_description: k.company_description ?? '',
    industry: k.industry ?? '',
    target_audience: k.target_audience ?? '',
    brand_voice: k.brand_voice ?? '',
    logo_url: k.logo_url ?? '',
    mascot_url: k.mascot_url ?? '',
    brand_colors: [
      k.brand_colors?.primary ?? '#F06464',
      k.brand_colors?.secondary ?? '#111111',
      k.brand_colors?.accent ?? '#EFE7D6',
    ],
    competitors: (k.competitors ?? []).join(', '),
    key_differentiators: k.key_differentiators ?? '',
    website_url: k.website_url ?? '',
  };
}

// ───────────────────── Header ────────────────────────────────────────────────

function OnboardingHeader({ step, total }: { step: number; total: number }) {
  return (
    <nav
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 32px',
        borderBottom: '3px solid #111',
        background: '#EFE7D6',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <Link
        href="/"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          textDecoration: 'none',
          color: '#111',
        }}
      >
        <Logo className="w-10 h-10" />
        <span style={{ fontFamily: FONT.head, fontSize: 20, letterSpacing: -0.5 }}>
          veqiro
        </span>
      </Link>
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 12,
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: '#111',
          padding: '8px 14px',
          border: '2px solid #111',
          borderRadius: 999,
          background: '#FFF9ED',
        }}
      >
        Step {step + 1} / {total}
      </div>
    </nav>
  );
}

// ───────────────────── Primitives ───────────────────────────────────────────

function Progress({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 10,
            flex: 1,
            borderRadius: 999,
            border: '2px solid #111',
            background: i <= step ? (i === step ? '#F5C518' : '#1DBC87') : '#EFE7D6',
            transition: 'background 220ms',
          }}
        />
      ))}
    </div>
  );
}

function StepShell({
  title,
  subtitle,
  children,
  emoji,
  bg = '#FFF9ED',
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  emoji?: string;
  bg?: string;
}) {
  return (
    <div
      style={{
        background: bg,
        border: '3px solid #111',
        borderRadius: 16,
        boxShadow: '10px 10px 0 #111',
        padding: 40,
        maxWidth: 720,
        margin: '0 auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        {emoji && (
          <div
            style={{
              width: 48,
              height: 48,
              background: '#F5C518',
              border: '3px solid #111',
              borderRadius: 12,
              display: 'grid',
              placeItems: 'center',
              fontFamily: FONT.display,
              fontSize: 24,
              transform: 'rotate(-6deg)',
              boxShadow: '3px 3px 0 #111',
            }}
          >
            {emoji}
          </div>
        )}
        <h2
          style={{
            fontFamily: FONT.display,
            fontSize: 44,
            lineHeight: 1,
            margin: 0,
            letterSpacing: -1,
            color: '#111',
          }}
        >
          {title}
        </h2>
      </div>
      {subtitle && (
        <p style={{ fontFamily: FONT.body, fontSize: 16, color: '#555', margin: '0 0 24px', lineHeight: 1.5 }}>
          {subtitle}
        </p>
      )}
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  color = '#F06464',
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? color : '#fff',
        color: '#111',
        border: '2.5px solid #111',
        borderRadius: 999,
        padding: '10px 18px',
        fontFamily: FONT.head,
        fontSize: 13,
        textTransform: 'uppercase',
        letterSpacing: 1,
        cursor: 'pointer',
        boxShadow: active ? '3px 3px 0 #111' : 'none',
        transform: active ? 'translate(-1px,-1px)' : 'none',
      }}
    >
      {children}
    </button>
  );
}

// ───────────────────── Steps ────────────────────────────────────────────────

type SetFn = <K extends keyof OnboardingKit>(k: K, v: OnboardingKit[K]) => void;

function Step0({
  name,
  slug,
  slugEdited,
  error,
  onName,
  onSlug,
}: {
  name: string;
  slug: string;
  slugEdited: boolean;
  error: string | null;
  onName: (v: string) => void;
  onSlug: (v: string) => void;
}) {
  return (
    <StepShell
      emoji="⁕"
      title="Name your workspace"
      subtitle="Your crew works inside a workspace. Name it whatever your team is called — you can rename later."
    >
      <FieldLabel label="Workspace name">
        <VqInput
          value={name}
          onChange={onName}
          placeholder="e.g. Lumen Beverage Co."
        />
      </FieldLabel>
      <FieldLabel label="Workspace URL" hint="Lowercase letters, numbers, dashes. This is the slug used in routes.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 13,
              color: '#666',
              padding: '10px 0',
              whiteSpace: 'nowrap',
            }}
          >
            veqiro.app/
          </div>
          <div style={{ flex: 1 }}>
            <VqInput
              value={slug}
              onChange={onSlug}
              placeholder="lumen-beverage"
            />
          </div>
        </div>
        {!slugEdited && slug && (
          <div style={{ fontFamily: FONT.mono, fontSize: 11, color: '#888', marginTop: 6 }}>
            auto-generated from name — feel free to edit
          </div>
        )}
      </FieldLabel>
      {error && (
        <div
          style={{
            marginTop: 4,
            padding: '12px 16px',
            background: '#FFE4E4',
            border: '2px solid #F06464',
            borderRadius: 10,
            fontFamily: FONT.body,
            fontSize: 14,
            color: '#8B1E1E',
          }}
        >
          {error}
        </div>
      )}
    </StepShell>
  );
}

function Step1({ kit, set }: { kit: OnboardingKit; set: SetFn }) {
  return (
    <StepShell
      emoji="①"
      title="Who's hiring us?"
      subtitle="The basics. So your crew knows which company's voice to speak in."
    >
      <FieldLabel label="Company name">
        <VqInput
          value={kit.company_name}
          onChange={(v) => set('company_name', v)}
          placeholder="e.g. Lumen Beverage Co."
        />
      </FieldLabel>
      <FieldLabel label="Company description" hint="1–2 sentences. What you make, for who.">
        <VqTextarea
          value={kit.company_description}
          onChange={(v) => set('company_description', v)}
          placeholder="We make adaptogenic sparkling drinks for people who quit coffee but still want to vibrate."
        />
      </FieldLabel>
      <FieldLabel label="Website">
        <VqInput
          value={kit.website_url}
          onChange={(v) => set('website_url', v)}
          placeholder="https://lumen.co"
        />
      </FieldLabel>
    </StepShell>
  );
}

function Step2({ kit, set }: { kit: OnboardingKit; set: SetFn }) {
  return (
    <StepShell
      emoji="②"
      title="What industry are we in?"
      subtitle="Pick one. The crew uses this to source benchmarks and avoid saying wild things."
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
        {INDUSTRIES.map((i) => (
          <Chip key={i} active={kit.industry === i} onClick={() => set('industry', i)} color="#6FCDE8">
            {i}
          </Chip>
        ))}
      </div>
      <FieldLabel label="Target audience" hint="Who buys this? Be specific.">
        <VqTextarea
          value={kit.target_audience}
          onChange={(v) => set('target_audience', v)}
          placeholder="Urban 25–34 wellness-curious folks who read labels and follow 3+ nutritionists on TikTok."
        />
      </FieldLabel>
    </StepShell>
  );
}

function Step3({ kit, set }: { kit: OnboardingKit; set: SetFn }) {
  return (
    <StepShell
      emoji="③"
      title="How do you sound?"
      subtitle="Pick a voice. We'll calibrate Maya and the rest. You can refine later."
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {VOICES.map(({ v, d }) => {
          const active = kit.brand_voice === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => set('brand_voice', v)}
              style={{
                background: active ? '#F79FD4' : '#fff',
                border: '3px solid #111',
                borderRadius: 12,
                padding: '18px 16px',
                textAlign: 'left',
                cursor: 'pointer',
                boxShadow: active ? '5px 5px 0 #111' : 'none',
                transform: active ? 'translate(-2px,-2px)' : 'none',
              }}
            >
              <div style={{ fontFamily: FONT.head, fontSize: 18 }}>{v}</div>
              <div style={{ fontFamily: FONT.mono, fontSize: 11, color: '#555', marginTop: 4 }}>
                {d}
              </div>
            </button>
          );
        })}
      </div>
    </StepShell>
  );
}

function Step4({ kit, set }: { kit: OnboardingKit; set: SetFn }) {
  const setColor = (i: number, v: string) => {
    const next: [string, string, string] = [...kit.brand_colors] as [string, string, string];
    next[i] = v;
    set('brand_colors', next);
  };

  return (
    <StepShell
      emoji="④"
      title="Brand colors"
      subtitle="Paste links to your logo and mascot if you have them. Pick a palette."
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <FieldLabel label="Logo URL">
          <VqInput
            value={kit.logo_url}
            onChange={(v) => set('logo_url', v)}
            placeholder="https://.../logo.svg"
          />
        </FieldLabel>
        <FieldLabel label="Mascot URL">
          <VqInput
            value={kit.mascot_url}
            onChange={(v) => set('mascot_url', v)}
            placeholder="https://.../mascot.png"
          />
        </FieldLabel>
      </div>
      <FieldLabel label="Brand colors" hint="Click a preset or edit hex values">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          {PRESET_PALETTES.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => set('brand_colors', p)}
              style={{
                display: 'flex',
                gap: 0,
                border: '3px solid #111',
                borderRadius: 10,
                overflow: 'hidden',
                cursor: 'pointer',
                padding: 0,
                background: '#fff',
                boxShadow:
                  JSON.stringify(kit.brand_colors) === JSON.stringify(p)
                    ? '4px 4px 0 #111'
                    : 'none',
              }}
            >
              {p.map((c) => (
                <div key={c} style={{ width: 28, height: 28, background: c }} />
              ))}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {kit.brand_colors.map((c, i) => (
            <div key={i} style={{ flex: 1 }}>
              <div
                style={{
                  height: 64,
                  background: c,
                  border: '3px solid #111',
                  borderRadius: 10,
                  marginBottom: 6,
                }}
              />
              <input
                value={c}
                onChange={(e) => setColor(i, e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: '2px solid #111',
                  borderRadius: 8,
                  fontFamily: FONT.mono,
                  fontSize: 12,
                  background: '#fff',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          ))}
        </div>
      </FieldLabel>
    </StepShell>
  );
}

function Step5({ kit, set }: { kit: OnboardingKit; set: SetFn }) {
  return (
    <StepShell
      emoji="⑤"
      title="The landscape"
      subtitle="Who's in your arena, and why are you different? Scout & Maya will use this daily."
    >
      <FieldLabel label="Competitors" hint="Comma-separated. 3–5 is plenty.">
        <VqTextarea
          value={kit.competitors}
          onChange={(v) => set('competitors', v)}
          placeholder="Olipop, Poppi, Recess, Aura Bora"
        />
      </FieldLabel>
      <FieldLabel
        label="Key differentiators"
        hint="Why you, not them. Short bullets work best."
      >
        <VqTextarea
          value={kit.key_differentiators}
          onChange={(v) => set('key_differentiators', v)}
          rows={4}
          placeholder={
            '• Only adaptogenic line with functional mushrooms\n• 0g sugar, not “low sugar”\n• Shipped in 100% recycled cans'
          }
        />
      </FieldLabel>
    </StepShell>
  );
}

function Step6({ kit }: { kit: OnboardingKit }) {
  const chips: [string, string][] = [
    ['Company', kit.company_name || '—'],
    ['Industry', kit.industry || '—'],
    ['Voice', kit.brand_voice || '—'],
    ['Website', kit.website_url || '—'],
  ];
  return (
    <StepShell
      emoji="✓"
      title="All set. Ready to meet the crew?"
      subtitle="Here's what the agents will learn on day one. You can edit anything later from the dashboard."
      bg="#F5E5C8"
    >
      <div
        style={{
          background: '#fff',
          border: '3px solid #111',
          borderRadius: 12,
          padding: 24,
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'grid', gap: 14 }}>
          {chips.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', borderBottom: '1px dashed #ccc', paddingBottom: 10 }}>
              <div
                style={{
                  width: 120,
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  color: '#666',
                }}
              >
                {k}
              </div>
              <div style={{ fontFamily: FONT.body, fontSize: 15, flex: 1 }}>{v}</div>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                width: 120,
                fontFamily: FONT.mono,
                fontSize: 11,
                letterSpacing: 2,
                textTransform: 'uppercase',
                color: '#666',
              }}
            >
              Palette
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {kit.brand_colors.map((c, i) => (
                <div
                  key={i}
                  style={{
                    width: 32,
                    height: 32,
                    background: c,
                    border: '2px solid #111',
                    borderRadius: 6,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div
        style={{
          background: '#111',
          color: '#EFE7D6',
          border: '3px solid #111',
          borderRadius: 12,
          padding: 20,
          display: 'flex',
          gap: 16,
          alignItems: 'center',
        }}
      >
        <div style={{ fontFamily: FONT.display, fontSize: 48, color: '#F5C518', lineHeight: 1 }}>
          6
        </div>
        <div>
          <div style={{ fontFamily: FONT.head, fontSize: 16 }}>
            AI employees ready to clock in
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 12, opacity: 0.7, marginTop: 4 }}>
            vega · scout · maya · sage · lex · rex
          </div>
        </div>
      </div>
    </StepShell>
  );
}

// ───────────────────── Page ─────────────────────────────────────────────────

const TOTAL = 7;

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const { data: activeOrg, isPending: orgLoading } = authClient.useActiveOrganization();
  const organizationId = activeOrg?.id ?? '';

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step-0 (create workspace) state
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [creatingOrg, setCreatingOrg] = useState(false);

  const [kit, setKit] = useState<OnboardingKit>(() => {
    if (typeof window === 'undefined') return DEFAULT_KIT;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      return saved ? { ...DEFAULT_KIT, ...JSON.parse(saved) } : DEFAULT_KIT;
    } catch {
      return DEFAULT_KIT;
    }
  });

  // If user already has an active org, skip Step 0 automatically.
  useEffect(() => {
    if (orgLoading) return;
    if (organizationId && step === 0) {
      setStep(1);
    }
  }, [organizationId, orgLoading, step]);

  // Hydrate from backend once we have an org. Backend wins over local draft.
  // Also: if kit is already complete, bounce to dashboard (returning user).
  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    getBrandKit(organizationId).then((bk) => {
      if (cancelled || !bk) return;
      if (bk.company_name?.trim()) {
        setKit(fromBrandKit(bk));
        // Returning, already-onboarded user landed here — send them home.
        router.replace('/dashboard');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId, router]);

  // Session gate — redirect unauth'd users.
  useEffect(() => {
    if (sessionLoading) return;
    if (!session?.user) router.replace('/login');
  }, [session, sessionLoading, router]);

  // Draft-buffer persistence.
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(kit));
    } catch {
      /* ignore */
    }
  }, [kit]);

  // Keep slug auto-derived from name until the user edits it.
  useEffect(() => {
    if (!slugEdited) setOrgSlug(slugify(orgName));
  }, [orgName, slugEdited]);

  const set: SetFn = (k, v) => setKit((prev) => ({ ...prev, [k]: v }));

  const canAdvance = () => {
    if (step === 0) return orgName.trim().length >= 2 && orgSlug.trim().length >= 2;
    if (step === 1) return kit.company_name.trim().length > 1;
    if (step === 2) return kit.industry.length > 0 && kit.target_audience.trim().length > 2;
    if (step === 3) return !!kit.brand_voice;
    return true;
  };

  const handleNext = async () => {
    if (step === 0) {
      // Create the org, then set active, then advance.
      setOrgError(null);
      setCreatingOrg(true);
      const created = await createOrganization({
        name: orgName.trim(),
        slug: orgSlug.trim() || slugify(orgName),
      });
      if (!created.ok) {
        setOrgError(created.message);
        setCreatingOrg(false);
        return;
      }
      const activated = await setActiveOrganization(created.id);
      setCreatingOrg(false);
      if (!activated.ok) {
        setOrgError(activated.message ?? 'Workspace created but could not be activated. Refresh and try again.');
        return;
      }
      // Pre-fill company_name from workspace name for convenience.
      if (!kit.company_name) setKit((prev) => ({ ...prev, company_name: orgName.trim() }));
      setStep((s) => s + 1);
      return;
    }
    setStep((s) => s + 1);
  };

  const finish = async () => {
    if (!organizationId) {
      toast.error('No workspace found. Create one first.');
      setStep(0);
      return;
    }
    setSaving(true);
    try {
      const payload = toBrandKit(kit);
      const result = await saveBrandKit(organizationId, payload);
      // Always persist to localStorage so /brain has data even if backend is offline.
      try {
        localStorage.setItem(
          `veqiro.brandKitLocal.${organizationId}`,
          JSON.stringify(payload),
        );
        localStorage.setItem(`veqiro.brain.seeded.${organizationId}`, '1');
      } catch {
        /* ignore */
      }
      if (result.unavailable) {
        toast.info("Brain storage is being set up — we'll keep your draft locally.");
      } else if (!result.ok) {
        toast.error('Could not save brand kit. Your draft is kept locally.');
        setSaving(false);
        return;
      } else {
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {
          /* ignore */
        }
        toast.success('Brand kit saved. Meet the crew.');
      }
      router.push('/dashboard');
    } catch {
      toast.error('Could not save brand kit. Your draft is kept locally.');
      setSaving(false);
    }
  };

  const steps = [
    <Step0
      key={0}
      name={orgName}
      slug={orgSlug}
      slugEdited={slugEdited}
      error={orgError}
      onName={(v) => setOrgName(v)}
      onSlug={(v) => {
        setSlugEdited(true);
        setOrgSlug(slugify(v));
      }}
    />,
    <Step1 key={1} kit={kit} set={set} />,
    <Step2 key={2} kit={kit} set={set} />,
    <Step3 key={3} kit={kit} set={set} />,
    <Step4 key={4} kit={kit} set={set} />,
    <Step5 key={5} kit={kit} set={set} />,
    <Step6 key={6} kit={kit} />,
  ];

  return (
    <div style={{ background: '#EFE7D6', minHeight: '100vh' }}>
      <div className="noise-overlay" aria-hidden />
      <OnboardingHeader step={step} total={TOTAL} />

      <div style={{ padding: '40px 24px 80px', position: 'relative' }}>
        <div style={{ maxWidth: 720, margin: '0 auto 28px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <Sticker rot={-4} color="#1DBC87">
              Step {step + 1} of {TOTAL}
            </Sticker>
            <div style={{ fontFamily: FONT.mono, fontSize: 12, color: '#555' }}>
              ≈ {Math.max(1, TOTAL - step - 1) * 2} min left
            </div>
          </div>
          <Progress step={step} total={TOTAL} />
        </div>

        <div style={{ position: 'absolute', left: '6%', top: 160, zIndex: 0 }}>
          <Sticker rot={-14} color="#F5C518">
            briefing in progress
          </Sticker>
        </div>
        <div style={{ position: 'absolute', right: '6%', top: 220, zIndex: 0 }}>
          <Sticker rot={10} color="#F06464">
            auto-saved ✦
          </Sticker>
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>{steps[step]}</div>

        <div
          style={{
            maxWidth: 720,
            margin: '28px auto 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || saving || creatingOrg}
          >
            ← Back
          </Button>
          {step < TOTAL - 1 ? (
            <Button
              variant="primary"
              onClick={handleNext}
              disabled={!canAdvance() || creatingOrg}
            >
              {creatingOrg ? 'Creating…' : 'Continue →'}
            </Button>
          ) : (
            <Button variant="dark" onClick={finish} disabled={saving}>
              {saving ? 'Saving…' : 'Meet the crew →'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
