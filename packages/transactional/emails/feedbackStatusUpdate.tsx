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

type FeedbackStatus = "NEW" | "UNDER_REVIEW" | "PLANNED" | "IN_PROGRESS" | "LAUNCHED" | "DECLINED";

interface FeedbackStatusUpdateEmailProps {
  postTitle: string;
  newStatus: FeedbackStatus;
  postUrl: string;
  userName: string;
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
  green: "#4CAF50",
  orange: "#FF9800",
  purple: "#9C27B0",
  red: "#F44336",
};

const fontStack =
  '"Space Grotesk", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const displayStack =
  '"Bagel Fat One", "Archivo Black", Impact, Arial Black, ui-sans-serif, system-ui, sans-serif';

const monoStack =
  '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace';

const getStatusConfig = (status: FeedbackStatus) => {
  const configs: Record<FeedbackStatus, { icon: string; label: string; color: string; bgColor: string }> = {
    NEW: { icon: "✨", label: "New", color: colors.ink, bgColor: colors.yellow },
    UNDER_REVIEW: { icon: "🔍", label: "Under Review", color: colors.ink, bgColor: colors.blue },
    PLANNED: { icon: "📋", label: "Planned", color: "#fff", bgColor: colors.purple },
    IN_PROGRESS: { icon: "🔨", label: "In Progress", color: "#fff", bgColor: colors.orange },
    LAUNCHED: { icon: "🚀", label: "Launched", color: "#fff", bgColor: colors.green },
    DECLINED: { icon: "❌", label: "Declined", color: "#fff", bgColor: colors.red },
  };
  return configs[status];
};

export function FeedbackStatusUpdateEmail({
  postTitle,
  newStatus,
  postUrl,
  userName,
  logoUrl = "https://blob.veqiro.com/logo.png",
}: FeedbackStatusUpdateEmailProps) {
  const name = userName?.trim() || "there";
  const statusConfig = getStatusConfig(newStatus);

  return (
    <Html>
      <Head />
      <Preview>
        Update on "{postTitle}": {statusConfig.label}
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
            <Text style={kickerStyle}>// feedback update</Text>
            <Heading as="h1" style={headingStyle}>
              {postTitle}
            </Heading>

            <Text style={paragraphStyle}>Hey {name},</Text>

            <Text style={paragraphStyle}>
              The feedback you voted for has been updated. Here's the latest status:
            </Text>

            <Section style={statusBadgeWrapperStyle}>
              <div style={statusBadgeStyle(statusConfig.bgColor)}>
                <span style={{ fontSize: "28px", marginRight: "12px" }}>
                  {statusConfig.icon}
                </span>
                <span style={statusBadgeLabelStyle(statusConfig.color)}>
                  {statusConfig.label}
                </span>
              </div>
            </Section>

            <Text style={paragraphStyle}>
              {newStatus === "LAUNCHED" &&
                "Great news! The feature you voted for has been shipped and is now available."}
              {newStatus === "IN_PROGRESS" &&
                "The crew is hard at work on this one. Check back soon for updates."}
              {newStatus === "PLANNED" &&
                "This feature is now on the roadmap and will be prioritized for development."}
              {newStatus === "UNDER_REVIEW" &&
                "The crew is reviewing this feedback and will decide on next steps soon."}
              {newStatus === "DECLINED" &&
                "After careful consideration, this feedback won't be pursued at this time."}
              {newStatus === "NEW" &&
                "Thanks for your vote! The crew will review this feedback soon."}
            </Text>

            <Section style={ctaWrapStyle}>
              <Button href={postUrl} style={buttonStyle}>
                View Update
              </Button>
            </Section>

            <Hr style={hrStyle} />

            <Text style={paragraphStyle}>
              Keep voting and sharing feedback to help shape the future of Veqiro.
            </Text>

            <Text style={fallbackLabelStyle}>Button not behaving?</Text>
            <Text style={fallbackTextStyle}>
              Paste this link into your browser:
            </Text>
            <Text style={linkStyle}>{postUrl}</Text>
          </Section>

          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              You received this email because you voted on this feedback post.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

FeedbackStatusUpdateEmail.PreviewProps = {
  postTitle: "Add dark mode to the dashboard",
  newStatus: "IN_PROGRESS",
  postUrl: "https://console.veqiro.com/feedback/abc123",
  userName: "Jane from Acme",
  logoUrl: "https://blob.veqiro.com/logo.png",
} satisfies FeedbackStatusUpdateEmailProps;

export default FeedbackStatusUpdateEmail;

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

const statusBadgeWrapperStyle = {
  margin: "26px 0 22px",
  display: "flex",
  justifyContent: "center",
};

const statusBadgeStyle = (bgColor: string): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "14px 20px",
  border: `3px solid ${colors.ink}`,
  backgroundColor: bgColor,
  borderRadius: "8px",
  fontWeight: "700",
  fontSize: "18px",
  boxShadow: `6px 6px 0 ${colors.ink}`,
});

const statusBadgeLabelStyle = (textColor: string): React.CSSProperties => ({
  color: textColor,
  fontFamily: fontStack,
  fontWeight: "800",
  fontSize: "16px",
});

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
  margin: "0 0 16px",
  color: colors.muted,
  fontSize: "13px",
  lineHeight: "1.5",
};
