import { PageNav } from '@/components/veqiro/page-nav';
import { Footer } from '@/components/veqiro/sections';
import { FONT } from '@/components/veqiro/shared';
import { contact } from '@/lib/site-config';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Privacy Policy',
  description: 'How Veqiro collects, uses, and protects your data. GDPR and CCPA compliant.',
  path: '/privacy',
});

function Section({ n, title, id, children }: { n: string; title: string; id?: string; children: React.ReactNode }) {
  return (
    <div id={id} style={{ marginBottom: 48 }}>
      <h2 style={{
        fontFamily: FONT.head,
        fontSize: 18,
        margin: '0 0 16px',
        textTransform: 'uppercase',
        letterSpacing: 1,
        borderBottom: '1px solid rgba(20,18,14,0.10)',
        paddingBottom: 8,
        display: 'flex',
        alignItems: 'baseline',
        gap: 12,
      }}>
        <span style={{ fontFamily: FONT.mono, fontSize: 13, color: '#aaa', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{n}.</span>
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

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ fontFamily: FONT.body, fontSize: 16, lineHeight: 1.7, color: '#333' }}>
      {children}
    </li>
  );
}

export default function PrivacyPage() {
  const updated = 'April 23, 2026';

  return (
    <div style={{ background: '#EFE7D6', minHeight: '100vh' }}>
      <PageNav />

      {/* Header */}
      <section style={{
        padding: 'clamp(40px, 7vw, 64px) clamp(16px, 4vw, 32px) clamp(32px, 5vw, 48px)',
        borderTop: '1px solid rgba(20,18,14,0.10)',
        borderBottom: '1px solid rgba(20,18,14,0.10)',
        background: '#111',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: '#F5C518', marginBottom: 16 }}>
            Legal
          </div>
          <h1 style={{ fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em', fontSize: 'clamp(40px, 6vw, 80px)', margin: 0, color: '#EFE7D6', lineHeight: 0.9 }}>
            Privacy Policy
          </h1>
          <p style={{ fontFamily: FONT.mono, fontSize: 13, color: '#666', marginTop: 20, marginBottom: 0 }}>
            Effective date: {updated}
          </p>
        </div>
      </section>

      {/* Content */}
      <section style={{ padding: 'clamp(48px, 8vw, 80px) clamp(16px, 4vw, 32px)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>

          {/* Intro */}
          <P>Welcome to Veqiro. Your privacy is important to us. This Privacy Policy explains how we collect, use, and protect your information when you use our platform. By using Veqiro, you agree to this Privacy Policy.</P>

          {/* TL;DR */}
          <div style={{
            background: '#FBF7EF', border: '1px solid rgba(20,18,14,0.10)', borderRadius: 14,
            padding: '24px 28px', boxShadow: '0 1px 3px rgba(20,18,14,0.05), 0 8px 24px -6px rgba(20,18,14,0.09)', marginBottom: 56,
          }}>
            <div style={{ fontFamily: FONT.head, fontSize: 12, textTransform: 'uppercase', letterSpacing: 2, color: '#666', marginBottom: 12 }}>
              Short version
            </div>
            <ul style={{ margin: 0, padding: '0 0 0 20px', display: 'grid', gap: 8 }}>
              {[
                "We collect only what's needed — account info, usage data, and what you share with the AI.",
                "We do not sell your personal data. Ever.",
                "You can access, update, or delete your data at any time.",
                "We use industry-standard security measures to protect your information.",
                `Questions? ${contact.email}`,
              ].map(item => (
                <li key={item} style={{ fontFamily: FONT.body, fontSize: 15, lineHeight: 1.55, color: '#333' }}>{item}</li>
              ))}
            </ul>
          </div>

          <Section n="1" title="Information We Collect">
            <P>We may collect the following types of information:</P>
            <ul style={{ margin: '0 0 16px', padding: '0 0 0 24px', display: 'grid', gap: 8 }}>
              <Li><strong>Personal Information</strong> — Name, email address, phone number</Li>
              <Li><strong>Business Information</strong> — Startup details, pitch decks, documents you share with our agents</Li>
              <Li><strong>Usage Data</strong> — App interactions, feature usage, logs, and analytics</Li>
              <Li><strong>Communication Data</strong> — Messages, emails, and feedback you send us</Li>
            </ul>
          </Section>

          <Section n="2" title="How We Use Your Information">
            <P>We use your data to:</P>
            <ul style={{ margin: '0 0 16px', padding: '0 0 0 24px', display: 'grid', gap: 8 }}>
              <Li>Provide and continuously improve our services</Li>
              <Li>Connect you with AI tools and personalized agent features</Li>
              <Li>Analyze usage patterns for performance and reliability improvements</Li>
              <Li>Communicate product updates, support responses, and service notices</Li>
            </ul>
          </Section>

          <Section n="3" title="Data Protection">
            <P>We implement industry-standard security measures — including encryption at rest and in transit, access controls, and regular security audits — to protect your data.</P>
            <P>No system is 100% secure. In the event of a breach affecting your data, we will notify you promptly.</P>
          </Section>

          <Section n="4" title="Data Sharing">
            <P>We do <strong>not</strong> sell your personal data. We may share information only in the following circumstances:</P>
            <ul style={{ margin: '0 0 16px', padding: '0 0 0 24px', display: 'grid', gap: 8 }}>
              <Li>With trusted service providers who help us operate the platform (cloud infrastructure, payment processors)</Li>
              <Li>When required by law or to respond to valid legal process</Li>
              <Li>To protect the integrity and security of the Veqiro platform</Li>
            </ul>
          </Section>

          <Section n="5" title="User Rights">
            <P>You have the right to:</P>
            <ul style={{ margin: '0 0 16px', padding: '0 0 0 24px', display: 'grid', gap: 8 }}>
              <Li>Access the personal data we hold about you</Li>
              <Li>Request correction or deletion of your data</Li>
              <Li>Update your account information at any time</Li>
            </ul>
            <P>To exercise any of these rights, email us at <a href={`mailto:${contact.email}`} style={{ color: '#111', fontWeight: 700 }}>{contact.email}</a>. We respond within 30 days.</P>
          </Section>

          <Section n="6" title="Cookies" id="cookies">
            <P>We may use cookies to enhance your experience on the platform — for example, to keep you logged in and remember your preferences. You can disable cookies in your browser settings, though some features may not function correctly without them.</P>
          </Section>

          <Section n="7" title="Changes to Policy">
            <P>We may update this Privacy Policy from time to time. When we do, we will revise the effective date at the top of this page. For material changes, we will notify you by email or via an in-app notice. Continued use of Veqiro after changes constitutes your acceptance of the updated policy.</P>
          </Section>

          <Section n="8" title="Contact">
            <P>Questions or concerns about this Privacy Policy? Email us at <a href={`mailto:${contact.email}`} style={{ color: '#111', fontWeight: 700 }}>{contact.email}</a></P>
            <P>Veqiro Labs · {contact.address}</P>
          </Section>

        </div>
      </section>

      <Footer />
    </div>
  );
}
