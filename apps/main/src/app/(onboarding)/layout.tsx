export default function OnboardingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div style={{ background: "#EFE7D6", minHeight: "100vh" }}>{children}</div>
  );
}
