"use client";

export interface SavedChat {
  id: string;
  title: string;
  createdAt: string;
  lastMessage?: string;
}

const CHATS_STORAGE_KEY = "growzzy.recent_chats.v1";
const EVENT_NAME = "growzzy:chats-updated";

export function loadSavedChats(): SavedChat[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CHATS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveChatSession(chat: { id: string; title: string; lastMessage?: string }) {
  if (typeof window === "undefined") return;
  const existing = loadSavedChats();
  const filtered = existing.filter((c) => c.id !== chat.id);
  const updated: SavedChat[] = [
    {
      id: chat.id,
      title: chat.title || "New Campaign Chat",
      createdAt: new Date().toISOString(),
      lastMessage: chat.lastMessage,
    },
    ...filtered,
  ].slice(0, 20);

  window.localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event(EVENT_NAME));
  window.dispatchEvent(new Event("growzzy:prompt-history-updated"));
}

export function deleteSavedChat(id: string) {
  if (typeof window === "undefined") return;
  const existing = loadSavedChats();
  const updated = existing.filter((c) => c.id !== id);
  window.localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event(EVENT_NAME));
  window.dispatchEvent(new Event("growzzy:prompt-history-updated"));
}
