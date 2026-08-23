"use client";

import {
  useState,
  type DragEvent,
  type HTMLAttributes,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

function acceptsFile(file: File, accept?: string) {
  if (!accept) return true;

  return accept.split(",").some((rawRule) => {
    const rule = rawRule.trim().toLowerCase();
    if (!rule) return false;
    if (rule.startsWith(".")) return file.name.toLowerCase().endsWith(rule);
    if (rule.endsWith("/*"))
      return file.type.toLowerCase().startsWith(rule.slice(0, -1));
    return file.type.toLowerCase() === rule;
  });
}

export function useFileDrop({
  accept,
  multiple = false,
  disabled = false,
  onFiles,
}: {
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const hasFiles = (event: DragEvent<HTMLElement>) =>
    Array.from(event.dataTransfer.types).includes("Files");

  return {
    isDragging,
    dropProps: {
      onDragEnter(event: DragEvent<HTMLElement>) {
        if (disabled || !hasFiles(event)) return;
        event.preventDefault();
        setIsDragging(true);
      },
      onDragOver(event: DragEvent<HTMLElement>) {
        if (disabled || !hasFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      },
      onDragLeave(event: DragEvent<HTMLElement>) {
        if (disabled || !hasFiles(event)) return;
        event.preventDefault();
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsDragging(false);
        }
      },
      onDrop(event: DragEvent<HTMLElement>) {
        if (disabled || !hasFiles(event)) return;
        event.preventDefault();
        setIsDragging(false);

        const files = Array.from(event.dataTransfer.files).filter((file) =>
          acceptsFile(file, accept),
        );
        onFiles(multiple ? files : files.slice(0, 1));
      },
    },
  };
}

export function FileDropTarget({
  accept,
  multiple,
  disabled,
  onFiles,
  children,
  dragOverlay,
  className,
  ...props
}: {
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  children: ReactNode;
  dragOverlay?: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, "onDrop">) {
  const { isDragging, dropProps } = useFileDrop({
    accept,
    multiple,
    disabled,
    onFiles,
  });

  return (
    <div
      {...props}
      {...dropProps}
      className={cn(
        "relative",
        className,
        isDragging && "ring-2 ring-primary/30 ring-inset",
      )}
    >
      {children}
      {isDragging && dragOverlay && (
        <div className="bg-background absolute inset-0 z-10 rounded-[inherit]">
          {dragOverlay}
        </div>
      )}
    </div>
  );
}
