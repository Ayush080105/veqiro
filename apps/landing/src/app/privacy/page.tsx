import type { Metadata } from 'next';
import { PageNav } from '@/components/veqiro/page-nav';
import { Footer } from '@/components/veqiro/sections';
import { FONT } from '@/components/veqiro/shared';
import { contact } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Privacy Policy | Veqiro',
  description: 'How Veqiro collects, uses, and protects your data.',
};

function Section({ title, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 48 }}>
      <h2 style={{
        fontFamily: FONT.head,
        fontSize: 18,
        margin: '0 0 16px',
        textTransform: 'uppercase',
        letterSpacing: 1,
        borderBottom: '3px solid #111',
        paddingBottom: 8,
      }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: FONT.body, fontSize: 16, lineHeight: 1.8, color: '#333', margin: '0 0 16px' }}>
      {children}
    </p>
  );
}

export default function PrivacyPage() {
  const updated = 'April 23, 2026';

  return (
    <div style={{ background: '#EFE7D6', minHeight: '100vh' }}>
      <PageNav />

      {/* Header */}
      <section style={{
        padding: '64px 32px 48px',
        borderTop: '3px solid #111',
        borderBottom: '3px solid #111',
        background: '#111',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{
            fontFamily: FONT.mono,
            fontSize: 12,
            letterSpacing: 3,
            textTransform: 'uppercase',
            color: '#F5C518',
            marginBottom: 16,
          }}>
            [ LEGAL ]
          </div>
          <h1 style={{
            fontFamily: FONT.display,
            fontSize: 'clamp(40px, 6vw, 80px)',
            margin: 0,
            color: '#EFE7D6',
            lineHeight: 0.9,
          }}>
            Privacy Policy
          </h1>
          <p style={{
            fontFamily: FONT.mono,
            fontSize: 13,
            color: '#666',
            marginTop: 20,
            marginBottom: 0,
          }}>
            Last updated: {updated}
          </p>
        </div>
      </section>

      {/* Content */}
      <section style={{ padding: '80px 32px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>

          {/* TL;DR */}
          <div style={{
            background: '#FFF9ED', border: '3px solid #111', borderRadius: 14,
            padding: '24px 28px', boxShadow: '5px 5px 0 #111', marginBottom: 56,
          }}>
            <div style={{
              fontFamily: FONT.head, fontSize: 12, textTransform: 'uppercase',
              letterSpacing: 2, color: '#666', marginBottom: 12,
            }}>
              Short version
            </div>
            <ul style={{ margin: 0, padding: '0 0 0 20px', display: 'grid', gap: 8 }}>
              {[
                "Your data stays yours. We don't train AI models on your content.",
                "We collect only what's needed to run the service (account info, usage, integrations).",
                "You can delete your account and all data at any time.",
                "We're SOC 2 Type II certified. Data is encrypted at rest and in transit.",
                "Questions? hello@veqiro.com — we respond within 24 hours.",
              ].map(item => (
                <li key={item} style={{ fontFamily: FONT.body, fontSize: 15, lineHeight: 1.55, color: '#333' }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <Section title="1. Overview">
            <P>Veqiro Labs ("we", "us", "our") operates the Veqiro platform — a suite of AI-powered assistants. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our services.</P>
            <P>By using Veqiro, you agree to the terms of this policy. If you disagree, please do not use the platform.</P>
          </Section>

          <Section title="2. Information We Collect">
            <P><strong>Account data:</strong> Name, email address, company name, billing information, and any other details you provide during signup or onboarding.</P>
            <P><strong>Usage data:</strong> Pages visited, features used, agent interactions, session duration, and device/browser metadata.</P>
            <P><strong>Content data:</strong> Text, documents, and other content you share with our AI agents to perform tasks (emails, contracts, briefs, etc.).</P>
            <P><strong>Integration data:</strong> If you connect third-party services (Google Workspace, LinkedIn, Twitter, etc.), we store only the OAuth tokens and the data required to complete the requested tasks.</P>
          </Section>

          <Section title="3. How We Use Your Data">
            <P>We use collected data to: provide and improve the Veqiro platform; personalize AI agent responses to your brand and preferences; process payments and manage your subscription; send service-related communications (never marketing without consent); comply with legal obligations.</P>
            <P><strong>We do not train our AI models on your data.</strong> Your content is used only to perform the tasks you request.</P>
          </Section>

          <Section title="4. Data Sharing">
            <P>We do not sell your personal data. We share data only with: (a) sub-processors required to operate the service (cloud infrastructure, payment processors, LLM API providers); (b) law enforcement when legally required; (c) acquirers in a merger or acquisition, with prior notice to you.</P>
            <P>All sub-processors are bound by data processing agreements with equivalent privacy protections.</P>
          </Section>

          <Section title="5. Cookies" id="cookies">
            <P>We use strictly necessary cookies (session management, authentication) and optional analytics cookies (aggregate usage stats). We do not use advertising cookies. You can disable optional cookies in your browser settings.</P>
          </Section>

          <Section title="6. Data Retention">
            <P>We retain your data for as long as your account is active or as needed to provide services. After account deletion, personal data is purged within 30 days. Content data is purged immediately on request.</P>
          </Section>

          <Section title="7. Your Rights (GDPR / CCPA)">
            <P>Depending on your location, you may have the right to: access, correct, or delete your personal data; export your data in a portable format; opt out of certain data processing; withdraw consent at any time.</P>
            <P>To exercise these rights, email us at <a href={`mailto:${contact.email}`} style={{ color: '#111', fontWeight: 700 }}>{contact.email}</a>. We respond within 30 days.</P>
          </Section>

          <Section title="8. Security">
            <P>We implement SOC 2 Type II controls including encryption at rest (AES-256) and in transit (TLS 1.3), access controls, audit logging, and regular penetration testing. No method is 100% secure — we will notify you promptly of any breach affecting your data.</P>
          </Section>

          <Section title="9. Children">
            <P>Veqiro is not directed at children under 16. We do not knowingly collect data from minors. If you believe a minor has provided us data, contact us immediately.</P>
          </Section>

          <Section title="10. Changes to This Policy">
            <P>We may update this policy periodically. We will notify you by email or in-app notice at least 30 days before material changes take effect. Continued use constitutes acceptance.</P>
          </Section>

          <Section title="11. Contact">
            <P>Questions about this policy? Email us: <a href={`mailto:${contact.email}`} style={{ color: '#111', fontWeight: 700 }}>{contact.email}</a></P>
            <P>Veqiro Labs · {contact.address}</P>
          </Section>
        </div>
      </section>

      <Footer />
    </div>
  );
}
