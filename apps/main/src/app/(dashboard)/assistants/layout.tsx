import ChatList from "@/components/assistants/ChatList"

export default function AssistantsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className="-m-4"
      style={{
        display: "flex",
        height: "calc(100vh - 3rem)",
        overflow: "hidden",
        background: "#EFE7D6",
      }}
    >
      <ChatList />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  )
}
