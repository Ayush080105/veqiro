import { redirect } from "next/navigation"

// `/workspace` is a grouping prefix (briefing/inbox/calendar), not a page of
// its own — send visitors to the default section instead of 404ing, whether
// they got here via a bookmark, a typed URL, or browser back/forward.
export default function WorkspaceIndexPage() {
  redirect("/workspace/briefing")
}
