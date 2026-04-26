"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ButtonProps = React.ComponentProps<typeof Button>

export interface SubmitButtonProps extends ButtonProps {
  isLoading?: boolean
  loadingText?: string
}

export function SubmitButton({
  isLoading = false,
  loadingText,
  type = "submit",
  variant = "brand",
  size = "brand",
  className,
  children,
  disabled,
  ...rest
}: SubmitButtonProps) {
  return (
    <Button
      type={type}
      variant={variant}
      size={size}
      disabled={disabled || isLoading}
      data-loading={isLoading || undefined}
      className={cn("w-full", className)}
      {...rest}
    >
      {isLoading ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          {loadingText ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  )
}
