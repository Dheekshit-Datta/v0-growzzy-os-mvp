"use client";

import React, { memo } from "react";
import { cn } from "@/lib/utils";

export interface TextShimmerProps {
  children: string;
  className?: string;
}

export const Shimmer = memo(({ children, className }: TextShimmerProps) => {
  return (
    <span
      className={cn(
        "inline-block bg-gradient-to-r from-muted-foreground via-foreground to-muted-foreground bg-[length:200%_100%] bg-clip-text text-transparent animate-pulse",
        className
      )}
    >
      {children}
    </span>
  );
});

Shimmer.displayName = "Shimmer";
