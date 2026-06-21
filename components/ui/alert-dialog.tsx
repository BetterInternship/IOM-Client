"use client"

import { AlertTriangle, AlertOctagon } from "lucide-react";
import * as React from "react"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { VariantProps } from "class-variance-authority"

function AlertDialog({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogTrigger({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  )
}

function AlertDialogPortal({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  )
}

function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

type AlertTone = "default" | "warning" | "destructive"

function AlertDialogContent({
  className,
  variant = "default",
  withIcon = true,
  heading,
  children,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content> & {
  /** Visual tone; matches CustomCard */
  variant?: AlertTone
  /** Show the leading icon for warning/destructive */
  withIcon?: boolean
  /** Optional heading row above Title/Description */
  heading?: React.ReactNode
}) {
  const tone =
    variant === "warning"
      ? "border-warning bg-warning/5"
      : variant === "destructive"
      ? "border-destructive"
      : "border"

  const Icon =
    variant === "warning" ? AlertTriangle : variant === "destructive" ? AlertOctagon : null

  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed left-1/2 top-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          tone,
          className
        )}
        {...props}
      >
        {Icon && withIcon && (
          <div className="mb-1 flex items-center gap-2 text-sm font-medium">
            <Icon
              className={cn(
                "h-4 w-4",
                variant === "warning" ? "text-amber-700" : "text-rose-700"
              )}
              aria-hidden="true"
            />
            <span className={cn(variant === "warning" ? "text-amber-800" : "text-rose-800")}>
              {heading ?? (variant === "warning" ? "Warning" : "Attention")}
            </span>
          </div>
        )}

        {children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  );
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

type ButtonStyleProps = VariantProps<typeof buttonVariants> & {
  asChild?: boolean
}

function AlertDialogAction({
  className,
  variant = "default",
  scheme = "primary",
  size = "default",
  asChild,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action> & ButtonStyleProps) {
  return (
    <AlertDialogPrimitive.Action
      asChild={asChild}
      className={cn(buttonVariants({ variant, scheme, size }), className)}
      {...props}
    />
  )
}

function AlertDialogCancel({
  className,
  variant = "outline",
  scheme,
  size = "default",
  asChild,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel> & ButtonStyleProps) {
  return (
    <AlertDialogPrimitive.Cancel
      asChild={asChild}
      className={cn(buttonVariants({ variant, scheme, size }), className)}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
