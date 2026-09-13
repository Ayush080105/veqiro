"use client"

/**
 * Renders agent-generated HTML (Sage's blog drafts, Rex's board decks) in a
 * sandboxed iframe instead of the app's own DOM. `srcDoc` + `sandbox`
 * (scripts allowed, everything else denied — notably no allow-same-origin)
 * gives the content an opaque origin: any script it runs can't read the
 * parent window, cookies, or the app's own session. Without this, LLM output
 * that echoes something it scraped/researched verbatim is an XSS path running
 * with the user's real session — worth taking seriously even though nothing
 * so far is known to have hit it.
 */
export function ArtifactHtmlViewer({ html, title }: { html: string; title?: string }) {
  return (
    <iframe
      title={title ?? "Preview"}
      sandbox="allow-scripts"
      srcDoc={html}
      style={{ width: "100%", height: "100%", border: "none", background: "white" }}
    />
  )
}
