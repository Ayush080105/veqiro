import { Button, Html, Head, Body } from "@react-email/components";
import React from "react";
interface VerificationEmailProps {
  url: string;
  fullName: string;
}

export function VerificationEmail({ url, fullName }: VerificationEmailProps) {
  return (
    <Html>
      <Head />
      <Body>
        <Button
          href="https://pitchdesk.in"
          style={{ background: "#000", color: "#fff", padding: "12px 20px" }}
        >
          Click me
        </Button>
      </Body>
    </Html>
  );
}