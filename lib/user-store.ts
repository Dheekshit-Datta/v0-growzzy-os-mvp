/**
 * The signed-in person's own profile, persisted in this browser.
 * Nothing here is pre-filled with demo data — every surface that shows a name
 * reads it from here so the app is personalised per user instead of static.
 */
import { useEffect, useState } from "react";

export interface UserProfile {
  name: string;
  email: string;
}

export const emptyUser: UserProfile = { name: "", email: "" };

const KEY = "growzzy.user.v1";
const EVENT = "growzzy:user-updated";

export function loadUser(): UserProfile {
  if (typeof window === "undefined") return emptyUser;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyUser;
    return { ...emptyUser, ...(JSON.parse(raw) as Partial<UserProfile>) };
  } catch {
    return emptyUser;
  }
}

export function saveUser(profile: UserProfile) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(profile));
  window.dispatchEvent(new Event(EVENT));
}

/** First name, or an empty string when the user hasn't told us yet. */
export function firstName(p: UserProfile): string {
  return p.name.trim().split(/\s+/)[0] ?? "";
}

export function initials(p: UserProfile): string {
  const parts = p.name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  return (parts[0]![0]! + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Hydration-safe: starts empty on the server and first client render. */
export function useUserProfile(): UserProfile {
  const [user, setUser] = useState<UserProfile>(emptyUser);
  useEffect(() => {
    const sync = () => setUser(loadUser());
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  return user;
}
