import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "bg-background pointer-events-auto relative z-10 flex h-8 w-full rounded-[0.33em] border border-gray-200 px-[0.75em] py-[1.25em] text-base ring-0 focus:ring-transparent sm:text-sm",
          "file:text-foreground placeholder:text-muted-foreground/40 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
