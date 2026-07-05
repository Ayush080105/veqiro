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

interface ScheduledPostFailedEmailProps {
  platform: string;
  caption: string;
  error: string;
  userName: string;
  calendarUrl: string;
  logoUrl?: string;
}

const colors = {
  ink: "#111111",
  cream: "#F6EFDF",
  card: "#FFF9EC",
  yellow: "#F5C518",
  red: "#F44336",
  muted: "#6F675B",
  rule: "#D7CEBC",
};

const fontStack =
  '"Space Grotesk", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const displayStack =
  '"Bagel Fat One", "Archivo Black", Impact, Arial Black, ui-sans-serif, system-ui, sans-serif';

const monoStack =
  '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace';

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

export function ScheduledPostFailedEmail({
  platform,
  caption,
  error,
  userName,
  calendarUrl,
  logoUrl = "https://blob.veqiro.com/logo.png",
}: ScheduledPostFailedEmailProps) {
  const name = userName?.trim() || "there";
  const platformLabel = platform.charAt(0) + platform.slice(1).toLowerCase();

  return (
    <Html>
      <Head />
      <Preview>Your scheduled {platformLabel} post failed to publish</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={brandSectionStyle}>
            <Img src={logoUrl} width="172" height="50" alt="Veqiro" style={logoImageStyle} />
          </Section>

          <Section style={cardStyle}>
            <Text style={kickerStyle}>// maya scheduled post</Text>
            <Heading as="h1" style={headingStyle}>
              A scheduled post failed to publish
            </Heading>

            <Text style={paragraphStyle}>Hey {name},</Text>

            <Text style={paragraphStyle}>
              Your scheduled {platformLabel} post didn&apos;t go out as planned. Here&apos;s what happened:
            </Text>

            <Section style={errorBoxStyle}>
              <Text style={errorLabelStyle}>Error</Text>
              <Text style={errorTextStyle}>{error}</Text>
            </Section>

            <Text style={captionLabelStyle}>Caption</Text>
            <Text style={captionTextStyle}>{truncate(caption, 280)}</Text>

            <Section style={ctaWrapStyle}>
              <Button href={calendarUrl} style={buttonStyle}>
                View in calendar
              </Button>
            </Section>

            <Hr style={hrStyle} />

            <Text style={fallbackLabelStyle}>Button not behaving?</Text>
            <Text style={fallbackTextStyle}>Paste this link into your browser:</Text>
            <Text style={linkStyle}>{calendarUrl}</Text>
          </Section>

          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              You received this email because you scheduled a post with Maya.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

ScheduledPostFailedEmail.PreviewProps = {
  platform: "INSTAGRAM",
  caption: "Excited to launch our new product today! #launch #startup",
  error: "Instagram connection expired. Please reconnect this integration.",
  userName: "Jane from Acme",
  calendarUrl: "https://console.veqiro.com/assistants/maya",
  logoUrl: "https://blob.veqiro.com/logo.png",
} satisfies ScheduledPostFailedEmailProps;

export default ScheduledPostFailedEmail;

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
  fontSize: "34px",
  fontWeight: "900",
  letterSpacing: "0",
  lineHeight: "1.12",
};

const paragraphStyle = {
  margin: "0 0 18px",
  color: colors.ink,
  fontSize: "16px",
  lineHeight: "1.6",
};

const errorBoxStyle = {
  margin: "0 0 22px",
  padding: "14px 16px",
  border: `2px solid ${colors.red}`,
  backgroundColor: "#FDECEA",
  borderRadius: "8px",
};

const errorLabelStyle = {
  margin: "0 0 4px",
  color: colors.red,
  fontFamily: monoStack,
  fontSize: "10px",
  fontWeight: "800",
  letterSpacing: "1.4px",
  textTransform: "uppercase" as const,
};

const errorTextStyle = {
  margin: "0",
  color: colors.ink,
  fontSize: "14px",
  lineHeight: "1.5",
};

const captionLabelStyle = {
  margin: "0 0 4px",
  color: colors.muted,
  fontFamily: monoStack,
  fontSize: "10px",
  fontWeight: "700",
  letterSpacing: "1.4px",
  textTransform: "uppercase" as const,
};

const captionTextStyle = {
  margin: "0 0 22px",
  color: colors.ink,
  fontSize: "14px",
  lineHeight: "1.5",
  fontStyle: "italic" as const,
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
  color: colors.red,
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
