"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface MarkdownMessageProps {
  content: string
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="mb-2 text-sm font-bold">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-1.5 text-xs font-bold">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-1 text-xs font-semibold">{children}</h3>
        ),
        p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
        ul: ({ children }) => (
          <ul className="mb-1.5 ml-4 list-disc space-y-0.5">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-1.5 ml-4 list-decimal space-y-0.5">{children}</ol>
        ),
        li: ({ children }) => <li>{children}</li>,
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ children, className }) => {
          const isBlock = className?.includes("language-")
          if (isBlock) {
            return (
              <code className="block my-1.5 rounded bg-background/50 p-2 font-mono text-[11px] overflow-x-auto">
                {children}
              </code>
            )
          }
          return (
            <code className="rounded bg-background/50 px-1 py-0.5 font-mono text-[11px]">
              {children}
            </code>
          )
        },
        pre: ({ children }) => <pre className="my-1.5">{children}</pre>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-1.5 border-l-2 border-muted-foreground/30 pl-3 italic text-muted-foreground">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="my-1.5 overflow-x-auto">
            <table className="w-full text-left text-[11px]">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border-b border-border px-2 py-1 font-semibold">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border-b border-border/50 px-2 py-1">{children}</td>
        ),
        hr: () => <hr className="my-2 border-border/50" />,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
