'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { authClient } from '@/lib/auth-client';
import { getBrandKit, finalizeBrandKit } from '@/lib/api/brain';
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
import { CharCount } from '@/components/forms/CharCount';
import { AssetUpload } from '@/components/forms/AssetUpload';
import {
  BRAND_KIT_MINS,
  onboardingSchema,
  type OnboardingValues,
} from '@/lib/schemas/brand-kit';

// ─── Constants ───────────────────────────────────────────────────────────────

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

// Schema lives in @/lib/schemas/brand-kit (used by both onboarding + finalize).

type OnboardingFormValues = OnboardingValues;

const DEFAULT_VALUES: OnboardingFormValues = {
  companyName: '',
  companyDescription: '',
  industry: '',
  targetAudience: '',
  brandVoice: '',
  websiteUrl: '',
  logoUrl: null,
  logoKey: null,
  mascotUrl: null,
  mascotKey: null,
  brandColors: ['#F06464', '#111111', '#EFE7D6'],
  competitors: '',
  keyDifferentiators: '',
};

const DRAFT_KEY = 'veqiro.brandKitDraft';

function valuesToBrandKit(v: OnboardingFormValues): Partial<BrandKit> {
  return {
    companyName: v.companyName,
    companyDescription: v.companyDescription,
    industry: v.industry,
    targetAudience: v.targetAudience,
    brandVoice: v.brandVoice,
    logoUrl: v.logoUrl,
    logoKey: v.logoKey,
    mascotUrl: v.mascotUrl,
    mascotKey: v.mascotKey,
    brandColors: {
      primary: v.brandColors[0],
      secondary: v.brandColors[1],
      accent: v.brandColors[2],
    },
    platformTones: { twitter: '', linkedin: '', instagram: '' },
    competitors: v.competitors
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    keyDifferentiators: v.keyDifferentiators,
    websiteUrl: v.websiteUrl,
  };
}

function brandKitToValues(k: BrandKit): OnboardingFormValues {
  const c = k.brandColors ?? {};
  return {
    companyName: k.companyName ?? '',
    companyDescription: k.companyDescription ?? '',
    industry: k.industry ?? '',
    targetAudience: k.targetAudience ?? '',
    brandVoice: k.brandVoice ?? '',
    websiteUrl: k.websiteUrl ?? '',
    logoUrl: k.logoUrl ?? null,
    logoKey: k.logoKey ?? null,
    mascotUrl: k.mascotUrl ?? null,
    mascotKey: k.mascotKey ?? null,
    brandColors: [
      c.primary ?? '#F06464',
      c.secondary ?? '#111111',
      c.accent ?? '#EFE7D6',
    ],
    competitors: (k.competitors ?? []).join(', '),
    keyDifferentiators: k.keyDifferentiators ?? '',
  };
}

// ─── Header ──────────────────────────────────────────────────────────────────

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

// ─── Primitives ──────────────────────────────────────────────────────────────

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

function ErrorRow({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      style={{
        marginTop: 6,
        fontFamily: FONT.mono,
        fontSize: 11,
        color: '#8B1E1E',
      }}
    >
      {message}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

const TOTAL = 7;

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const { data: activeOrg, isPending: orgLoading } = authClient.useActiveOrganization();
  const organizationId = activeOrg?.id ?? '';

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step-0 (create workspace) state — kept outside RHF since it's about the org.
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [creatingOrg, setCreatingOrg] = useState(false);

  const initialDefaults = (): OnboardingFormValues => {
    if (typeof window === 'undefined') return DEFAULT_VALUES;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      return saved ? { ...DEFAULT_VALUES, ...JSON.parse(saved) } : DEFAULT_VALUES;
    } catch {
      return DEFAULT_VALUES;
    }
  };

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: initialDefaults(),
    mode: 'onChange',
  });

  // Track watched form values for previewing in summary + persisting drafts.
  const watched = useWatch({ control });

  // If user already has an active org, skip Step 0 automatically.
  useEffect(() => {
    if (orgLoading) return;
    if (organizationId && step === 0) {
      setStep(1);
    }
  }, [organizationId, orgLoading, step]);

  // Hydrate from backend once we have an org. Backend wins over local draft.
  // Returning user with a populated kit goes straight to dashboard.
  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    getBrandKit(organizationId).then((bk) => {
      if (cancelled || !bk) return;
      if (bk.companyName?.trim()) {
        reset(brandKitToValues(bk));
        router.replace('/dashboard');
      } else {
        // Brand kit exists (probably created by an asset upload) but is otherwise
        // empty — pre-fill any uploaded urls into the form.
        const next = brandKitToValues(bk);
        const current = getValues();
        reset({ ...current, logoUrl: next.logoUrl, logoKey: next.logoKey, mascotUrl: next.mascotUrl, mascotKey: next.mascotKey });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId, router, reset, getValues]);

  // Session gate — redirect unauth'd users.
  useEffect(() => {
    if (sessionLoading) return;
    if (!session?.user) router.replace('/login');
  }, [session, sessionLoading, router]);

  // Draft-buffer persistence.
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(watched));
    } catch {
      /* ignore */
    }
  }, [watched]);

  // Keep slug auto-derived from name until the user edits it.
  useEffect(() => {
    if (!slugEdited) setOrgSlug(slugify(orgName));
  }, [orgName, slugEdited]);

  const canAdvance = async (): Promise<boolean> => {
    if (step === 0) return orgName.trim().length >= 2 && orgSlug.trim().length >= 2;
    if (step === 1)
      return await trigger(['companyName', 'companyDescription', 'websiteUrl']);
    if (step === 2) return await trigger(['industry', 'targetAudience']);
    if (step === 3) return await trigger(['brandVoice']);
    if (step === 4) return true; // visuals optional
    if (step === 5) return await trigger(['keyDifferentiators']);
    return true;
  };

  const handleNext = async () => {
    if (step === 0) {
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
      // Pre-fill company_name from workspace name.
      if (!getValues('companyName')) setValue('companyName', orgName.trim());
      setStep((s) => s + 1);
      return;
    }

    if (!(await canAdvance())) {
      toast.error('Fix the highlighted fields to continue.');
      return;
    }
    setStep((s) => s + 1);
  };

  const onFinish = async (values: OnboardingFormValues) => {
    if (!organizationId) {
      toast.error('No workspace found. Create one first.');
      setStep(0);
      return;
    }
    setSaving(true);
    try {
      const payload = valuesToBrandKit(values);
      const result = await finalizeBrandKit(organizationId, payload);

      // Always persist a local snapshot — useful if the user hits the brain
      // page before React Query refetches.
      try {
        localStorage.setItem(
          `veqiro.brandKitLocal.${organizationId}`,
          JSON.stringify(payload),
        );
        localStorage.setItem(`veqiro.brain.seeded.${organizationId}`, '1');
      } catch {
        /* ignore */
      }

      if (!result.ok) {
        // Try to surface the first field error and bounce to the right step.
        const fieldErrors = result.fieldErrors ?? {};
        const firstField = Object.keys(fieldErrors)[0];
        const message =
          fieldErrors[firstField] ??
          result.message ??
          'Could not save brand kit.';
        toast.error(message);
        if (firstField) {
          if (firstField === 'companyName' || firstField === 'companyDescription' || firstField === 'websiteUrl') setStep(1);
          else if (firstField === 'industry' || firstField === 'targetAudience') setStep(2);
          else if (firstField === 'brandVoice') setStep(3);
          else if (firstField === 'keyDifferentiators' || firstField === 'competitors') setStep(5);
        }
        setSaving(false);
        return;
      }

      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      toast.success('Brand kit saved. Meet the crew.');
      router.push('/dashboard');
    } catch {
      toast.error('Could not save brand kit. Your draft is kept locally.');
      setSaving(false);
    }
  };

  // ─── Steps ─────────────────────────────────────────────────────────────────

  const step1 = (
    <StepShell
      emoji="①"
      title="Who's hiring us?"
      subtitle="The basics. So your crew knows which company's voice to speak in."
    >
      <FieldLabel label="Company name">
        <Controller
          name="companyName"
          control={control}
          render={({ field }) => (
            <VqInput
              value={field.value}
              onChange={field.onChange}
              placeholder="e.g. Lumen Beverage Co."
            />
          )}
        />
        <ErrorRow message={errors.companyName?.message} />
      </FieldLabel>

      <FieldLabel label="Company description" hint="What you make, for who. Aim for 1–2 specific sentences.">
        <Controller
          name="companyDescription"
          control={control}
          render={({ field }) => (
            <>
              <VqTextarea
                value={field.value}
                onChange={field.onChange}
                rows={4}
                placeholder="We make adaptogenic sparkling drinks for people who quit coffee but still want to vibrate."
              />
              <CharCount
                value={field.value}
                min={BRAND_KIT_MINS.companyDescription}
                max={2000}
                hint="Concrete > generic"
              />
            </>
          )}
        />
        <ErrorRow message={errors.companyDescription?.message} />
      </FieldLabel>

      <FieldLabel label="Website">
        <Controller
          name="websiteUrl"
          control={control}
          render={({ field }) => (
            <VqInput
              value={field.value}
              onChange={field.onChange}
              placeholder="https://lumen.co"
            />
          )}
        />
        <ErrorRow message={errors.websiteUrl?.message} />
      </FieldLabel>
    </StepShell>
  );

  const step2 = (
    <StepShell
      emoji="②"
      title="What industry are we in?"
      subtitle="Pick one. The crew uses this to source benchmarks and avoid saying wild things."
    >
      <Controller
        name="industry"
        control={control}
        render={({ field }) => (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
            {INDUSTRIES.map((i) => (
              <Chip key={i} active={field.value === i} onClick={() => field.onChange(i)} color="#6FCDE8">
                {i}
              </Chip>
            ))}
          </div>
        )}
      />
      <ErrorRow message={errors.industry?.message} />

      <FieldLabel label="Target audience" hint="Who buys this? Job titles, motivations, where they live online.">
        <Controller
          name="targetAudience"
          control={control}
          render={({ field }) => (
            <>
              <VqTextarea
                value={field.value}
                onChange={field.onChange}
                rows={4}
                placeholder="Urban 25–34 wellness-curious folks who read labels and follow 3+ nutritionists on TikTok."
              />
              <CharCount
                value={field.value}
                min={BRAND_KIT_MINS.targetAudience}
                max={1000}
                hint="Specifics make Maya's posts land"
              />
            </>
          )}
        />
        <ErrorRow message={errors.targetAudience?.message} />
      </FieldLabel>
    </StepShell>
  );

  const step3 = (
    <StepShell
      emoji="③"
      title="How do you sound?"
      subtitle="Pick a voice. We'll calibrate Maya and the rest. You can refine later."
    >
      <Controller
        name="brandVoice"
        control={control}
        render={({ field }) => (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {VOICES.map(({ v, d }) => {
              const active = field.value === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => field.onChange(v)}
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
        )}
      />
      <ErrorRow message={errors.brandVoice?.message} />
    </StepShell>
  );

  const step4 = (
    <StepShell
      emoji="④"
      title="Visual identity"
      subtitle="Upload your logo and (optionally) a mascot. Pick a palette."
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
        <Controller
          name="logoUrl"
          control={control}
          render={({ field }) => (
            <AssetUpload
              kind="logo"
              label="Logo"
              hint="PNG or SVG · under 5MB"
              value={field.value}
              onChange={({ url, key }) => {
                setValue('logoUrl', url, { shouldDirty: true });
                setValue('logoKey', key, { shouldDirty: true });
              }}
              disabled={!organizationId}
            />
          )}
        />
        <Controller
          name="mascotUrl"
          control={control}
          render={({ field }) => (
            <AssetUpload
              kind="mascot"
              label="Mascot (optional)"
              hint="A character that lives in your brand"
              value={field.value}
              onChange={({ url, key }) => {
                setValue('mascotUrl', url, { shouldDirty: true });
                setValue('mascotKey', key, { shouldDirty: true });
              }}
              disabled={!organizationId}
            />
          )}
        />
      </div>

      <FieldLabel label="Brand colors" hint="Click a preset or edit hex values">
        <Controller
          name="brandColors"
          control={control}
          render={({ field }) => (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                {PRESET_PALETTES.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => field.onChange(p)}
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
                        JSON.stringify(field.value) === JSON.stringify(p) ? '4px 4px 0 #111' : 'none',
                    }}
                  >
                    {p.map((c) => (
                      <div key={c} style={{ width: 28, height: 28, background: c }} />
                    ))}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {field.value.map((c, i) => (
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
                      onChange={(e) => {
                        const next: [string, string, string] = [...field.value] as [string, string, string];
                        next[i] = e.target.value;
                        field.onChange(next);
                      }}
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
            </>
          )}
        />
      </FieldLabel>
    </StepShell>
  );

  const step5 = (
    <StepShell
      emoji="⑤"
      title="The landscape"
      subtitle="Who's in your arena, and why are you different? Scout & Maya will use this daily."
    >
      <FieldLabel label="Competitors" hint="Comma-separated. 3–5 is plenty.">
        <Controller
          name="competitors"
          control={control}
          render={({ field }) => (
            <VqTextarea
              value={field.value}
              onChange={field.onChange}
              placeholder="Olipop, Poppi, Recess, Aura Bora"
            />
          )}
        />
      </FieldLabel>

      <FieldLabel
        label="Key differentiators"
        hint="Why you, not them. Concrete claims beat adjectives."
      >
        <Controller
          name="keyDifferentiators"
          control={control}
          render={({ field }) => (
            <>
              <VqTextarea
                value={field.value}
                onChange={field.onChange}
                rows={4}
                placeholder={
                  '• Only adaptogenic line with functional mushrooms\n• 0g sugar, not "low sugar"\n• Shipped in 100% recycled cans'
                }
              />
              <CharCount
                value={field.value}
                min={BRAND_KIT_MINS.keyDifferentiators}
                max={2000}
                hint="Bullets work great"
              />
            </>
          )}
        />
        <ErrorRow message={errors.keyDifferentiators?.message} />
      </FieldLabel>
    </StepShell>
  );

  const step6 = (() => {
    const v = watched as OnboardingFormValues;
    const chips: [string, string, number][] = [
      ['Company', v.companyName || '—', 1],
      ['Industry', v.industry || '—', 2],
      ['Voice', v.brandVoice || '—', 3],
      ['Website', v.websiteUrl || '—', 1],
      ['Logo', v.logoUrl ? 'uploaded ✓' : 'none', 4],
      ['Mascot', v.mascotUrl ? 'uploaded ✓' : 'none', 4],
    ];
    return (
      <StepShell
        emoji="✓"
        title="All set. Ready to meet the crew?"
        subtitle="Here's what the agents will learn on day one. You can edit anything later from the Brain page."
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
            {chips.map(([k, val, jumpTo]) => (
              <div
                key={k}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  borderBottom: '1px dashed #ccc',
                  paddingBottom: 10,
                  gap: 12,
                }}
              >
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
                <div style={{ fontFamily: FONT.body, fontSize: 15, flex: 1 }}>{val}</div>
                <button
                  type="button"
                  onClick={() => setStep(jumpTo)}
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10,
                    letterSpacing: 1.5,
                    textTransform: 'uppercase',
                    border: '2px solid #111',
                    borderRadius: 999,
                    padding: '4px 10px',
                    background: '#FFF9ED',
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
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
                {(v.brandColors ?? ['#fff', '#fff', '#fff']).map((c, i) => (
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
  })();

  const step0 = (
    <StepShell
      emoji="⁕"
      title="Name your workspace"
      subtitle="Your crew works inside a workspace. Name it whatever your team is called — you can rename later."
    >
      <FieldLabel label="Workspace name">
        <VqInput
          value={orgName}
          onChange={setOrgName}
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
              value={orgSlug}
              onChange={(v) => {
                setSlugEdited(true);
                setOrgSlug(slugify(v));
              }}
              placeholder="lumen-beverage"
            />
          </div>
        </div>
        {!slugEdited && orgSlug && (
          <div style={{ fontFamily: FONT.mono, fontSize: 11, color: '#888', marginTop: 6 }}>
            auto-generated from name — feel free to edit
          </div>
        )}
      </FieldLabel>
      {orgError && (
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
          {orgError}
        </div>
      )}
    </StepShell>
  );

  const steps = [step0, step1, step2, step3, step4, step5, step6];

  return (
    <div style={{ background: '#EFE7D6', minHeight: '100vh' }}>
      <div className="noise-overlay" aria-hidden />
      <OnboardingHeader step={step} total={TOTAL} />

      <form onSubmit={handleSubmit(onFinish)} style={{ padding: '40px 24px 80px', position: 'relative' }}>
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
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || saving || creatingOrg}
          >
            ← Back
          </Button>
          {step < TOTAL - 1 ? (
            <Button
              variant="primary"
              type="button"
              onClick={handleNext}
              disabled={creatingOrg}
            >
              {creatingOrg ? 'Creating…' : 'Continue →'}
            </Button>
          ) : (
            <Button variant="dark" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Meet the crew →'}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
