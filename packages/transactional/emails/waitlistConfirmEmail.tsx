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

interface WaitlistConfirmEmailProps {
  logoUrl?: string;
}

const colors = {
  ink: "#111111",
  cream: "#F6EFDF",
  card: "#FFF9EC",
  yellow: "#F5C518",
  coral: "#F06464",
  muted: "#6F675B",
  rule: "#D7CEBC",
};

const fontStack =
  '"Space Grotesk", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const displayStack =
  '"Bagel Fat One", "Archivo Black", Impact, Arial Black, ui-sans-serif, system-ui, sans-serif';

const monoStack =
  '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace';

export function WaitlistConfirmEmail({
  logoUrl = "https://blob.veqiro.com/logo.png",
}: WaitlistConfirmEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Your spot's locked. 30% off, founding member status, and first access —
        all yours.
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
            <Text style={kickerStyle}>// founding crew</Text>
            <Heading as="h1" style={headingStyle}>
              You're on the list.
            </Heading>

            <Text style={paragraphStyle}>
              Your spot is locked in. You're among the first people to sign up
              for Veqiro — and we won't forget that.
            </Text>

            <Text style={paragraphStyle}>
              As a founding member, you'll get{" "}
              <strong>30% off any plan, for life</strong> the moment we go live.
              That's your reward for betting on us early.
            </Text>

            <Text style={paragraphStyle}>
              Lex, Maya, Rex, Sage, Scout, and Vega are getting their final
              briefing. We're launching very soon — keep an eye on this inbox.
            </Text>

            <Section style={ctaWrapStyle}>
              <Button href="https://veqiro.com" style={buttonStyle}>
                Visit veqiro.com →
              </Button>
            </Section>

            <Hr style={hrStyle} />

            <Text style={fallbackLabelStyle}>Link not working?</Text>
            <Text style={fallbackTextStyle}>
              Paste this into your browser:
            </Text>
            <Text style={linkStyle}>https://veqiro.com</Text>
          </Section>

          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              You're receiving this because you joined the Veqiro waitlist at
              veqiro.com.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

WaitlistConfirmEmail.PreviewProps = {
  logoUrl: "https://blob.veqiro.com/logo.png",
} satisfies WaitlistConfirmEmailProps;

export default WaitlistConfirmEmail;

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
  margin: "0",
  color: colors.muted,
  fontSize: "13px",
  lineHeight: "1.5",
};
