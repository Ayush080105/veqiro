import { resend } from "../config/resend.js";
import { VerificationEmail } from "@repo/transactional/emails/verificationEmail.js";
import { ResetPasswordEmail } from "@repo/transactional/emails/resetPasswordEmail.js";



export async function sendEmail(
  type: "verifyEmail" | "resetPassword",
  email: string,
  url: string,
  fullName: string
) {
  const subject =
    type === "verifyEmail" ? "Verify your email" : "Reset your password";

  const EmailComponent =
    type === "verifyEmail"
      ? VerificationEmail({ url, fullName })
      : ResetPasswordEmail({ url, fullName });

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_USER!,
    to: email,
    subject,
    react: EmailComponent,
  });

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }

  return data;
}
