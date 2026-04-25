"use client"

import * as React from "react"
import { Check, Copy } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ButtonProps = React.ComponentProps<typeof Button>

interface CopyButtonProps
  extends Omit<ButtonProps, "onClick" | "children"> {
  text: string
  label?: string
  successLabel?: string
  /** Show only the icon (square button). */
  iconOnly?: boolean
}

export function CopyButton({
  text,
  label = "Copy",
  successLabel = "Copied!",
  iconOnly = false,
  variant = "outline",
  size,
  className,
  ...rest
}: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const onCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success(successLabel)
      timer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Could not copy to clipboard")
    }
  }, [text, successLabel])

  return (
    <Button
      type="button"
      variant={variant}
      size={size ?? (iconOnly ? "icon-sm" : "xs")}
      onClick={onCopy}
      aria-label={copied ? successLabel : label}
      className={cn(className)}
      {...rest}
    >
      {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
      {!iconOnly && (copied ? successLabel : label)}
    </Button>
  )
}
