"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowDownIcon, DownloadIcon } from "lucide-react";
export type UIMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  parts: Array<{ type: string; text?: string; [key: string]: any }>;
};

const StickContext = createContext<{
  isAtBottom: boolean;
  scrollToBottom: () => void;
}>({
  isAtBottom: true,
  scrollToBottom: () => {},
});

export const useStickToBottomContext = () => useContext(StickContext);

export function Conversation({
  className,
  children,
  ...props
}: ComponentProps<"div"> & { initial?: string; resize?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, []);

  const onScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setIsAtBottom(scrollHeight - scrollTop - clientHeight < 50);
  }, []);

  useEffect(() => {
    if (isAtBottom && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  });

  return (
    <StickContext.Provider value={{ isAtBottom, scrollToBottom }}>
      <div
        ref={containerRef}
        onScroll={onScroll}
        className={cn("relative flex-1 overflow-y-auto", className)}
        role="log"
        {...props}
      >
        {children}
      </div>
    </StickContext.Provider>
  );
}

export function ConversationContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-8 p-4", className)} {...props} />;
}

export function ConversationScrollButton({
  className,
  ...props
}: ComponentProps<typeof Button>) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  return (
    !isAtBottom && (
      <Button
        className={cn(
          "absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full dark:bg-background dark:hover:bg-muted shadow-md",
          className
        )}
        onClick={scrollToBottom}
        size="icon"
        type="button"
        variant="outline"
        {...props}
      >
        <ArrowDownIcon className="size-4" />
      </Button>
    )
  );
}

const getMessageText = (message: UIMessage): string =>
  message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part as { type: "text"; text: string }).text)
    .join("");

export function ConversationDownload({
  messages,
  filename = "conversation.md",
  className,
  children,
  ...props
}: ComponentProps<typeof Button> & { messages: UIMessage[]; filename?: string }) {
  const handleDownload = useCallback(() => {
    const text = messages
      .map((m) => `**${m.role.toUpperCase()}:** ${getMessageText(m)}`)
      .join("\n\n");
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [messages, filename]);

  return (
    <Button
      className={cn(
        "absolute top-4 right-4 rounded-full dark:bg-background dark:hover:bg-muted",
        className
      )}
      onClick={handleDownload}
      size="icon"
      type="button"
      variant="outline"
      {...props}
    >
      {children ?? <DownloadIcon className="size-4" />}
    </Button>
  );
}
