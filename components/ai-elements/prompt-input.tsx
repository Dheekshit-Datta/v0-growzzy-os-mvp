"use client";

import React, { createContext, useContext, useRef, useState, useCallback, type ComponentProps, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CornerDownLeftIcon, SquareIcon } from "lucide-react";
export type ChatStatus = "ready" | "submitted" | "streaming" | "error";

interface PromptInputContextType {
  value: string;
  setValue: (v: string) => void;
}

const PromptInputContext = createContext<PromptInputContextType>({
  value: "",
  setValue: () => {},
});

export function PromptInput({
  className,
  onSubmit,
  children,
  ...props
}: Omit<ComponentProps<"form">, "onSubmit"> & {
  onSubmit: (msg: { text: string; files: any[] }, event: FormEvent<HTMLFormElement>) => void;
}) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const textarea = e.currentTarget.querySelector("textarea");
    const text = textarea?.value || value || "";
    if (!text.trim()) return;
    onSubmit({ text, files: [] }, e);
    setValue("");
  };

  return (
    <PromptInputContext.Provider value={{ value, setValue }}>
      <form
        onSubmit={handleSubmit}
        className={cn(
          "relative flex flex-col rounded-2xl border border-border bg-card shadow-xs transition-shadow focus-within:ring-1 focus-within:ring-primary/20",
          className
        )}
        {...props}
      >
        {children}
      </form>
    </PromptInputContext.Provider>
  );
}

export function PromptInputTextarea({
  className,
  value: controlledValue,
  onChange: controlledOnChange,
  onKeyDown,
  placeholder = "Ask anything, or describe what to launch…",
  ...props
}: ComponentProps<typeof Textarea>) {
  const { value, setValue } = useContext(PromptInputContext);
  const actualValue = controlledValue !== undefined ? controlledValue : value;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(e);
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const form = e.currentTarget.closest("form");
      if (form) {
        form.requestSubmit();
      }
    }
  };

  return (
    <Textarea
      value={actualValue}
      onChange={(e) => {
        setValue(e.target.value);
        controlledOnChange?.(e);
      }}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={cn(
        "min-h-[60px] w-full resize-none border-0 bg-transparent px-4 pt-3.5 pb-2 text-[13.5px] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground",
        className
      )}
      rows={2}
      {...props}
    />
  );
}

export function PromptInputFooter({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 px-3 pb-2.5 pt-1 border-t border-border/40",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function PromptInputTools({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  return (
    <div className={cn("flex items-center gap-1.5", className)} {...props}>
      {children}
    </div>
  );
}

export function PromptInputSubmit({
  status,
  onStop,
  disabled,
  className,
  ...props
}: ComponentProps<typeof Button> & {
  status?: ChatStatus;
  onStop?: () => void;
}) {
  const isLoading = status === "streaming" || status === "submitted";

  if (isLoading && onStop) {
    return (
      <Button
        type="button"
        size="icon"
        variant="secondary"
        onClick={onStop}
        className={cn("h-8 w-8 rounded-full cursor-pointer", className)}
        {...props}
      >
        <SquareIcon className="h-3.5 w-3.5 fill-current" />
      </Button>
    );
  }

  return (
    <Button
      type="submit"
      size="icon"
      disabled={disabled}
      className={cn(
        "h-8 w-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-opacity disabled:opacity-40 cursor-pointer",
        className
      )}
      {...props}
    >
      <CornerDownLeftIcon className="h-3.5 w-3.5" />
    </Button>
  );
}
