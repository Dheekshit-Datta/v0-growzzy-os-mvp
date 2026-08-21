"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

const nav = [
  { to: "/dashboard/campaigns/new", label: "New Campaign" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/dashboard/ads", label: "Ads Manager" },
  { to: "/dashboard/analytics", label: "Analytics" },
  { to: "/dashboard/optimization", label: "AI Optimization" },
  { to: "/dashboard/studio", label: "Ad Studio" },
  { to: "/dashboard/projects", label: "Projects" },
  { to: "/dashboard/brand", label: "My Brand" },
  { to: "/dashboard/prompts", label: "Recent Prompts" },
  { to: "/dashboard/settings", label: "Settings" },
];

export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  return { open, setOpen };
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Jump to a section or search campaigns…" />
      <CommandList>
        <CommandEmpty>Nothing matches yet.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {nav.map((n) => (
            <CommandItem
              key={n.to}
              onSelect={() => {
                onOpenChange(false);
                router.push(n.to);
              }}
            >
              {n.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
