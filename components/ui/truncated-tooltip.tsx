"use client";

import type { ReactNode } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function TruncatedTooltip({
  children,
  content = children,
  className,
  delayDuration = 350,
}: {
  children: ReactNode;
  content?: ReactNode;
  className?: string;
  delayDuration?: number;
}) {
  return (
    <Tooltip delayDuration={delayDuration}>
      <TooltipTrigger asChild>
        <span
          className={["block min-w-0 flex-1 truncate", className ?? ""].join(
            " ",
          )}
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={8}
        collisionPadding={16}
        className="z-[1100] max-w-[min(28rem,calc(100vw-2rem))] bg-gray-900 px-3 py-2 text-sm leading-5 whitespace-normal text-white shadow-sm break-words"
        arrowClassName="fill-gray-900"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
