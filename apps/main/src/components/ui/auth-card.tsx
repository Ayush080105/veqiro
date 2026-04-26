"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Kicker } from "@/components/ui/kicker"

interface AuthCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional sticker rendered top-right (rotated). Pass <Sticker .../> or any node. */
  sticker?: React.ReactNode
  className?: string
  children: React.ReactNode
}

interface AuthCardHeaderProps {
  kicker?: string
  title: React.ReactNode
  subtitle?: React.ReactNode
  className?: string
}

interface AuthCardFooterProps {
  className?: string
  children: React.ReactNode
}

function AuthCardRoot({
  sticker,
  className,
  children,
  ...rest
}: AuthCardProps) {
  return (
    <div className="relative mx-auto w-full max-w-md">
      {sticker && (
        <div className="pointer-events-none absolute -top-4 right-4 z-10">
          {sticker}
        </div>
      )}
      <Card
        variant="brand"
        className={cn("w-full px-7 py-8 sm:px-9 sm:py-10", className)}
        {...rest}
      >
        {children}
      </Card>
    </div>
  )
}

function AuthCardHeader({
  kicker,
  title,
  subtitle,
  className,
}: AuthCardHeaderProps) {
  return (
    <div className={cn("mb-6 flex flex-col items-center gap-2 text-center", className)}>
      <h1 className="m-0 font-display text-[clamp(2rem,5vw,2.75rem)] leading-none tracking-tight text-foreground">
        {title}
      </h1>
      {kicker && (
        <Kicker prefix="//" tone="default" className="mt-1">
          {kicker}
        </Kicker>
      )}
      {subtitle && (
        <p className="m-0 mt-1 max-w-sm font-body text-sm leading-relaxed text-muted-foreground">
          {subtitle}
        </p>
      )}
    </div>
  )
}

function AuthCardFooter({ className, children }: AuthCardFooterProps) {
  return (
    <div
      className={cn(
        "mt-5 text-center font-body text-sm text-foreground",
        className
      )}
    >
      {children}
    </div>
  )
}

export const AuthCard = Object.assign(AuthCardRoot, {
  Header: AuthCardHeader,
  Footer: AuthCardFooter,
})
