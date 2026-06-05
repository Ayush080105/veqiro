"use client"

import { QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { getQueryClient } from "@/lib/query-client"

export default function QueryProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const queryClient = getQueryClient()
  const showDevtools =
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_ENABLE_QUERY_DEVTOOLS === "true"

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {showDevtools && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  )
}
