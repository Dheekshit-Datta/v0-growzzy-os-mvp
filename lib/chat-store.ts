"use client";

export interface SavedChat {
  id: string;
  title: string;
  createdAt: string;
  lastMessage?: string;
}

const CHATS_STORAGE_KEY = "growzzy.recent_chats.v1";
const DELETED_STORAGE_KEY = "growzzy.deleted_chat_ids.v1";
const EVENT_NAME = "growzzy:chats-updated";

export function getDeletedChatIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DELETED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function loadSavedChats(): SavedChat[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CHATS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const deleted = new Set(getDeletedChatIds());
    return (Array.isArray(parsed) ? parsed : []).filter((c) => c && c.id && !deleted.has(c.id));
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
  // 1. Mark as deleted forever
  const deleted = getDeletedChatIds();
  if (!deleted.includes(id)) {
    deleted.push(id);
    window.localStorage.setItem(DELETED_STORAGE_KEY, JSON.stringify(deleted));
  }

  // 2. Remove from local chats
  const existing = loadSavedChats();
  const updated = existing.filter((c) => c.id !== id);
  window.localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(updated));

  // 3. Remove from session storage
  try {
    window.sessionStorage.removeItem("growzzy_sidebar_prompts");
  } catch {}

  // 4. Try deleting from backend if it exists there
  fetch(`/api/ai/campaign-plans?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});

  window.dispatchEvent(new Event(EVENT_NAME));
  window.dispatchEvent(new Event("growzzy:prompt-history-updated"));
}
