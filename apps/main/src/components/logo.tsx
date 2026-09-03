import Image from "next/image";

import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

/** Veqiro mark — the flat icon tile, matching the landing page's brand-mark treatment. */
export default function Logo({ className }: LogoProps) {
  return (
    <Image
      src="/icon.png"
      alt=""
      width={64}
      height={64}
      priority
      className={cn("block h-auto w-full", className)}
    />
  );
}
