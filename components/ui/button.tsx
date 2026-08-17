import React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex",
    "items-center",
    "justify-center",
    "gap-2",
    "whitespace-nowrap",
    "rounded-[0.33em]",
    "text-sm",
    "font-medium",
    "transition-colors",
    "cursor-pointer",
    "focus:outline-none",
    "focus:ring-transparent",
    "disabled:pointer-events-none",
    "disabled:opacity-50",
    "[&_svg]:pointer-events-none",
    "[&_svg]:size-4",
    "[&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline:
          "border border-gray-300 text-gray-700 bg-background hover:bg-accent",
        ghost: "hover:bg-accent text-gray-700 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      scheme: {
        default: "",
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        supportive:
          "bg-supportive text-supportive-foreground hover:bg-supportive/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      },
      size: {
        default: "h-8 px-[1em] py-[0.33em]",
        sm: "h-8 px-3",
        lg: "h-11 px-8",
        md: "h-10 px-6",
        icon: "h-10 w-10",
        xs: "h-6 px-3 text-xs",
      },
      expandIcon: {
        true: "gap-2 overflow-hidden px-3 transition-[max-width,padding,gap] duration-200 sm:max-w-8 sm:gap-0 sm:px-2 hover:max-w-48 hover:gap-2 hover:px-3 focus-visible:max-w-48 focus-visible:gap-2 focus-visible:px-3 group-hover/status-notice:max-w-48 group-hover/status-notice:gap-2 group-hover/status-notice:px-3 [&_.button-label]:max-w-40 [&_.button-label]:overflow-hidden [&_.button-label]:opacity-100 [&_.button-label]:transition-[max-width,opacity] [&_.button-label]:duration-200 sm:[&_.button-label]:max-w-0 sm:[&_.button-label]:opacity-0 hover:[&_.button-label]:max-w-40 hover:[&_.button-label]:opacity-100 focus-visible:[&_.button-label]:max-w-40 focus-visible:[&_.button-label]:opacity-100 group-hover/status-notice:[&_.button-label]:max-w-40 group-hover/status-notice:[&_.button-label]:opacity-100",
        false: "",
      },
    },
    compoundVariants: [
      {
        variant: "outline",
        scheme: "primary",
        class:
          "bg-background border border-primary text-primary hover:bg-blue-50",
      },
      {
        variant: "outline",
        scheme: "supportive",
        class:
          "bg-background border border-supportive text-supportive hover:bg-green-50",
      },
      {
        variant: "outline",
        scheme: "destructive",
        class:
          "bg-background border border-destructive text-destructive hover:bg-red-50",
      },
      {
        variant: "ghost",
        scheme: "destructive",
        class:
          "bg-transparent text-destructive hover:bg-red-50 hover:text-destructive",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
      expandIcon: false,
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, scheme, size, expandIcon, asChild = false, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(
          buttonVariants({ variant, scheme, size, expandIcon, className }),
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
