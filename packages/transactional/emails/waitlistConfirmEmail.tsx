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
  blue: "#6FCDE8",
  green: "#1DBC87",
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
        You are officially on the Veqiro waitlist, with 30% off waiting for launch day.
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
            <Text style={kickerStyle}>// waitlist confirmed</Text>
            <Heading as="h1" style={headingStyle}>
              You made the list.
            </Heading>

            <Text style={paragraphStyle}>
              Your seat in the Veqiro queue is officially locked. The velvet
              rope has moved, the clipboard has your name, and the tiny launch
              machine is making dramatic beeping sounds.
            </Text>

            <Section style={discountBoxStyle}>
              <Text style={discountEyebrowStyle}>Early believer perk</Text>
              <Text style={discountValueStyle}>30% off</Text>
              <Text style={discountTextStyle}>
                When we open the doors, your Veqiro plan gets the early-access
                discount. No treasure map, no coupon archaeology.
              </Text>
            </Section>

            <Text style={paragraphStyle}>
              Maya is polishing hooks, Rex is counting beans, Sage is arranging
              keywords alphabetically for sport, and Vega is keeping the inbox
              civilized. We will email you as soon as your early access is ready.
            </Text>

            <Section style={ctaWrapStyle}>
              <Button href="https://veqiro.com" style={buttonStyle}>
                Visit veqiro.com
              </Button>
            </Section>

            <Hr style={hrStyle} />

            <Text style={fallbackLabelStyle}>Button not behaving?</Text>
            <Text style={fallbackTextStyle}>
              Paste this into your browser:
            </Text>
            <Text style={linkStyle}>https://veqiro.com</Text>
          </Section>

          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              You are receiving this because you joined the Veqiro waitlist at
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

const discountBoxStyle = {
  margin: "24px 0",
  padding: "22px",
  border: `3px solid ${colors.ink}`,
  backgroundColor: colors.blue,
  boxShadow: `6px 6px 0 ${colors.green}`,
};

const discountEyebrowStyle = {
  margin: "0 0 8px",
  color: colors.ink,
  fontFamily: monoStack,
  fontSize: "11px",
  fontWeight: "800",
  letterSpacing: "1.6px",
  lineHeight: "1",
  textTransform: "uppercase" as const,
};

const discountValueStyle = {
  margin: "0 0 8px",
  color: colors.ink,
  fontFamily: displayStack,
  fontSize: "46px",
  fontWeight: "900",
  letterSpacing: "0",
  lineHeight: "1",
};

const discountTextStyle = {
  margin: "0",
  color: colors.ink,
  fontSize: "15px",
  lineHeight: "1.55",
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
