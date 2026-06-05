import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import React from "react";

interface VerificationEmailProps {
  url: string;
  fullName: string;
  logoUrl?: string;
}

const colors = {
  ink: "#111111",
  cream: "#F6EFDF",
  card: "#FFF9EC",
  yellow: "#F5C518",
  coral: "#F06464",
  blue: "#6FCDE8",
  muted: "#6F675B",
  rule: "#D7CEBC",
};

const fontStack =
  '"Space Grotesk", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const displayStack =
  '"Bagel Fat One", "Archivo Black", Impact, Arial Black, ui-sans-serif, system-ui, sans-serif';

const strongStack =
  '"Archivo Black", "Space Grotesk", Inter, Arial, ui-sans-serif, system-ui, sans-serif';

const monoStack =
  '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace';

export function VerificationEmail({
  url,
  fullName,
  logoUrl = "https://blob.veqiro.com/logo.png",
}: VerificationEmailProps) {
  const name = fullName?.trim() || "there";

  return (
    <Html>
      
      <Head />
      <Preview>
        Your six AI employees are ready. Confirm your email to start the shift.
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={brandSectionStyle}>
            <Img
              src={logoUrl}
              width="172"
              height="50"
              alt="Veqiro"
              style={logoImageStyle}
            />
          </Section>

          <Section style={cardStyle}>
            <Text style={kickerStyle}>// crew on shift</Text>
            <Heading as="h1" style={headingStyle}>
              Your AI workforce is ready.
            </Heading>

            <Text style={paragraphStyle}>Hey {name},</Text>

            <Text style={paragraphStyle}>
              Welcome to <strong>Veqiro</strong>. Lex, Maya, Rex, Sage, Scout,
              and Vega are assembled at the dashboard and waiting for their
              first assignment.
            </Text>

            <Text style={paragraphStyle}>
              Before the crew starts reviewing contracts, drafting campaigns,
              spotting revenue leaks, finding SEO wins, tracking the market,
              and cleaning up your inbox, we need to verify this email belongs
              to you.
            </Text>

            <Section style={ctaWrapStyle}>
              <Button href={url} style={buttonStyle}>
                Verify email and clock in
              </Button>
            </Section>

            

            <Text style={paragraphStyle}>
              Once verified, your workspace will be ready and the crew can get
              to work.
            </Text>

            <Hr style={hrStyle} />

            <Text style={fallbackLabelStyle}>Button not behaving?</Text>
            <Text style={fallbackTextStyle}>
              Paste this link into your browser:
            </Text>
            <Text style={linkStyle}>{url}</Text>
          </Section>

          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              If you did not sign up for Veqiro, you can safely ignore this
              email.
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}

VerificationEmail.PreviewProps = {
  fullName: "Jane from Acme",
  url: "https://console.veqiro.com/verify?token=crew-on-shift",
  logoUrl: "https://blob.veqiro.com/logo.png",
} satisfies VerificationEmailProps;

export default VerificationEmail;

const bodyStyle = {
  margin: "0",
  backgroundColor: colors.cream,
  color: colors.ink,
  fontFamily: fontStack,
};

const containerStyle = {
  width: "100%",
  maxWidth: "640px",
  margin: "0 auto",
  padding: "32px 20px",
};

const brandSectionStyle = {
  marginBottom: "18px",
};

const logoImageStyle = {
  display: "block",
  width: "172px",
  height: "auto",
  border: "0",
  outline: "none",
};

const cardStyle = {
  border: `3px solid ${colors.ink}`,
  backgroundColor: colors.card,
  boxShadow: `8px 8px 0 ${colors.ink}`,
  padding: "34px 30px",
};

const kickerStyle = {
  display: "inline-block",
  margin: "0 0 16px",
  padding: "7px 10px",
  border: `2px solid ${colors.ink}`,
  backgroundColor: colors.yellow,
  color: colors.ink,
  fontFamily: monoStack,
  fontSize: "11px",
  fontWeight: "700",
  letterSpacing: "2.3px",
  lineHeight: "1",
  textTransform: "uppercase" as const,
};

const headingStyle = {
  margin: "0 0 22px",
  color: colors.ink,
  fontFamily: displayStack,
  fontSize: "40px",
  fontWeight: "900",
  letterSpacing: "0",
  lineHeight: "1.08",
};

const paragraphStyle = {
  margin: "0 0 18px",
  color: colors.ink,
  fontSize: "16px",
  lineHeight: "1.6",
};

const ctaWrapStyle = {
  margin: "28px 0",
};

const buttonStyle = {
  display: "inline-block",
  border: `3px solid ${colors.ink}`,
  backgroundColor: colors.yellow,
  color: colors.ink,
  fontFamily: fontStack,
  fontSize: "15px",
  fontWeight: "800",
  letterSpacing: "0.2px",
  lineHeight: "1.25",
  padding: "16px 22px",
  textDecoration: "none",
  textTransform: "uppercase" as const,
  boxShadow: `5px 5px 0 ${colors.ink}`,
};

const crewStripStyle = {
  margin: "8px 0 26px",
  padding: "14px",
  border: `2px solid ${colors.ink}`,
  backgroundColor: "#EFE6D3",
};

const crewBadgeStyle = {
  display: "inline-block",
  margin: "4px",
  padding: "6px 8px",
  border: `2px solid ${colors.ink}`,
  backgroundColor: colors.card,
  color: colors.ink,
  fontFamily: monoStack,
  fontSize: "10px",
  fontWeight: "800",
  letterSpacing: "1px",
  lineHeight: "1.2",
};

const hrStyle = {
  margin: "24px 0",
  borderColor: colors.rule,
  borderStyle: "dashed",
};

const fallbackLabelStyle = {
  margin: "0 0 8px",
  color: colors.coral,
  fontFamily: monoStack,
  fontSize: "11px",
  fontWeight: "800",
  letterSpacing: "1.4px",
  lineHeight: "1.4",
  textTransform: "uppercase" as const,
};

const fallbackTextStyle = {
  margin: "0 0 8px",
  color: colors.muted,
  fontSize: "13px",
  lineHeight: "1.45",
};

const linkStyle = {
  margin: "0",
  color: colors.ink,
  fontFamily: monoStack,
  fontSize: "12px",
  lineHeight: "1.5",
  overflowWrap: "break-word" as const,
};

const footerStyle = {
  padding: "24px 4px 0",
};

const footerTextStyle = {
  margin: "0 0 16px",
  color: colors.muted,
  fontSize: "13px",
  lineHeight: "1.5",
};

const signatureStyle = {
  margin: "0 0 8px",
  color: colors.ink,
  fontFamily: strongStack,
  fontSize: "15px",
  fontWeight: "900",
  lineHeight: "1.4",
};

const taglineStyle = {
  margin: "0",
  color: colors.muted,
  fontFamily: monoStack,
  fontSize: "11px",
  letterSpacing: "1.7px",
  textTransform: "uppercase" as const,
};
