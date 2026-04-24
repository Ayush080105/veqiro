import { PageNav } from '@/components/veqiro/page-nav';
import { Footer } from '@/components/veqiro/sections';
import { FONT } from '@/components/veqiro/shared';
import { contact } from '@/lib/site-config';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Terms of Service',
  description: 'The terms governing your use of the Veqiro platform.',
  path: '/terms',
  noindex: true,
});

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
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

export default function TermsPage() {
  const updated = 'April 23, 2026';

  return (
    <div style={{ background: '#EFE7D6', minHeight: '100vh' }}>
      <PageNav />

      {/* Header */}
      <section style={{
        padding: 'clamp(40px, 7vw, 64px) clamp(16px, 4vw, 32px) clamp(32px, 5vw, 48px)',
        borderTop: '3px solid #111',
        borderBottom: '3px solid #111',
        background: '#111',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: '#F5C518', marginBottom: 16 }}>
            [ LEGAL ]
          </div>
          <h1 style={{ fontFamily: FONT.display, fontSize: 'clamp(40px, 6vw, 80px)', margin: 0, color: '#EFE7D6', lineHeight: 0.9 }}>
            Terms of Service
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
          <P>By using Veqiro, you agree to the following terms. Please read them carefully before using the platform.</P>

          {/* TL;DR */}
          <div style={{
            background: '#FFF9ED', border: '3px solid #111', borderRadius: 14,
            padding: '24px 28px', boxShadow: '5px 5px 0 #F5C518', marginBottom: 56,
          }}>
            <div style={{ fontFamily: FONT.head, fontSize: 12, textTransform: 'uppercase', letterSpacing: 2, color: '#666', marginBottom: 12 }}>
              Short version
            </div>
            <ul style={{ margin: 0, padding: '0 0 0 20px', display: 'grid', gap: 8 }}>
              {[
                "Use Veqiro for legitimate business automation — no misuse, spam, or illegal content.",
                "You own your content. The platform and its brand belong to Veqiro.",
                "AI outputs may be reused to improve the system (fully anonymized).",
                "We're not liable for AI errors, business losses, or third-party outages.",
                "These terms are governed by Indian law. Questions? info@veqiro.com",
              ].map(item => (
                <li key={item} style={{ fontFamily: FONT.body, fontSize: 15, lineHeight: 1.55, color: '#333' }}>{item}</li>
              ))}
            </ul>
          </div>

          <Section n="1" title="Use of Service">
            <P>Veqiro provides AI-powered tools for business automation, analysis, and content generation. Access to the platform is subject to these terms and any additional guidelines we publish.</P>
            <P>We reserve the right to modify, suspend, or discontinue any part of the service with reasonable notice.</P>
          </Section>

          <Section n="2" title="User Responsibility">
            <P>By using Veqiro, you agree to:</P>
            <ul style={{ margin: '0 0 16px', padding: '0 0 0 24px', display: 'grid', gap: 8 }}>
              <Li>Not misuse the platform for any unlawful, harmful, or deceptive purpose</Li>
              <Li>Not upload illegal, harmful, or misleading content</Li>
              <Li>Ensure the accuracy of data and information you provide to the platform</Li>
              <Li>Maintain the security of your account credentials</Li>
              <Li>Not attempt to reverse-engineer, scrape, or extract our AI models</Li>
            </ul>
            <P>We may suspend accounts that violate these responsibilities without prior notice.</P>
          </Section>

          <Section n="3" title="Intellectual Property">
            <P><strong>Platform content:</strong> All platform code, agent personalities, interfaces, and brand elements belong to Veqiro Labs. You may not copy, redistribute, or create derivative works from them.</P>
            <P><strong>Your content:</strong> You retain full ownership of all content you create or upload. By using the service, you grant us a limited license to process your content solely to provide the service.</P>
            <P><strong>AI-generated content:</strong> Content generated by Veqiro agents in response to your prompts is owned by you. Anonymized outputs may be used to improve the system — no personally identifiable information is ever retained for this purpose.</P>
          </Section>

          <Section n="4" title="Limitation of Liability">
            <P>The service is provided "as is" without warranties of any kind, express or implied. Veqiro AI Agent outputs are not professional advice — legal, financial, medical, or otherwise. Always review outputs before acting on them.</P>
            <P>Veqiro is not liable for:</P>
            <ul style={{ margin: '0 0 16px', padding: '0 0 0 24px', display: 'grid', gap: 8 }}>
              <Li>Business losses arising from use of the platform</Li>
              <Li>Incorrect, incomplete, or misleading AI outputs</Li>
              <Li>Third-party service failures (cloud providers, LLM APIs, integrations)</Li>
            </ul>
            <P>To the maximum extent permitted by applicable law, our total liability is limited to the fees paid by you in the 12 months preceding the claim.</P>
          </Section>

          <Section n="5" title="Termination">
            <P>We reserve the right to suspend or terminate accounts for misuse, violation of these terms, or non-payment — with or without prior notice depending on severity.</P>
            <P>You may cancel your account at any time. Upon termination, your access ceases and your data is handled per our <a href="/privacy" style={{ color: '#111', fontWeight: 700 }}>Privacy Policy</a>.</P>
          </Section>

          <Section n="6" title="Governing Law">
            <P>These Terms are governed by the laws of India, without regard to conflict of law principles.</P>
          </Section>

          <Section n="7" title="Modifications">
            <P>We may update these Terms at any time. We will notify you of material changes via email or in-app notice where reasonably practicable. Your continued use of Veqiro after any update constitutes acceptance of the revised Terms.</P>
          </Section>

          <Section n="8" title="Contact">
            <P>Questions about these Terms? Reach us at <a href={`mailto:${contact.email}`} style={{ color: '#111', fontWeight: 700 }}>{contact.email}</a></P>
            <P>Veqiro Labs · {contact.address}</P>
          </Section>

        </div>
      </section>

      <Footer />
    </div>
  );
}
