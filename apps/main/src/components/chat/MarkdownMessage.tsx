"use client"

import * as React from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { ChatImage } from "@/components/chat/ChatImage"

interface MarkdownMessageProps {
  content: string
}

const remarkPlugins = [remarkGfm]

const markdownComponents: Components = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mb-1.5 text-sm font-bold" style={{ lineHeight: 1.2 }}>{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-1 text-xs font-bold" style={{ lineHeight: 1.2 }}>{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-1 text-xs font-semibold" style={{ lineHeight: 1.2 }}>{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-1.5 text-sm last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-1.5 ml-4 list-disc space-y-0.5 text-sm">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-1.5 ml-4 list-decimal space-y-0.5 text-sm">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => <em className="italic">{children}</em>,
  code: ({
    children,
    className,
  }: {
    children?: React.ReactNode
    className?: string
  }) => {
    const isBlock = className?.includes("language-")
    if (isBlock) {
      return (
        <code className="block my-1.5 rounded bg-background/50 p-2 font-mono text-xs overflow-x-auto">
          {children}
        </code>
      )
    }
    return (
      <code className="rounded bg-background/50 px-1 py-0.5 font-mono text-xs">
        {children}
      </code>
    )
  },
  pre: ({ children }: { children?: React.ReactNode }) => <pre className="my-1.5">{children}</pre>,
  a: ({
    href,
    children,
  }: {
    href?: string
    children?: React.ReactNode
  }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:text-primary/80"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-1.5 border-l-2 border-muted-foreground/30 pl-3 italic text-muted-foreground text-sm">
      {children}
    </blockquote>
  ),
  img: ({ src, alt }: { src?: string | Blob; alt?: string }) => {
    const srcStr = typeof src === "string" ? src : undefined
    return srcStr ? <ChatImage src={srcStr} alt={alt ?? ""} className="my-2" /> : null
  },
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-1.5 overflow-x-auto">
      <table className="w-full text-left text-xs">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border-b border-border px-2 py-1 font-semibold">
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border-b border-border/50 px-2 py-1">{children}</td>
  ),
  hr: () => <hr className="my-2 border-border/50" />,
}

function MarkdownMessageComponent({ content }: MarkdownMessageProps) {
  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      components={markdownComponents}
    >
      {content}
    </ReactMarkdown>
  )
}

export const MarkdownMessage = React.memo(MarkdownMessageComponent)
