import { FONT, Sticker } from "@/components/veqiro/shared"

export default function AssistantsIndexPage() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        background: "#EFE7D6",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          textAlign: "center",
          position: "relative",
          padding: "44px 36px",
          background: "#FFF9ED",
          border: "3px solid #111",
          borderRadius: 18,
          boxShadow: "8px 8px 0 #111",
        }}
      >
        <div style={{ position: "absolute", top: -22, left: 24 }}>
          <Sticker rot={-6} color="#F5C518">
            pick a chat
          </Sticker>
        </div>
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: "#666",
            marginBottom: 14,
          }}
        >
          [ your crew ]
        </div>
        <h1
          style={{
            fontFamily: FONT.display,
            fontSize: 56,
            margin: 0,
            lineHeight: 0.95,
            letterSpacing: -1,
            color: "#111",
          }}
        >
          who&apos;s up?
        </h1>
        <p
          style={{
            fontFamily: FONT.body,
            fontSize: 15,
            color: "#333",
            margin: "16px auto 0",
            maxWidth: 360,
            lineHeight: 1.5,
          }}
        >
          Pick an assistant on the left to open the conversation. Each one has a
          specialty and a personality — just say hi.
        </p>
      </div>
    </div>
  )
}
