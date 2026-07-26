"use client";

import {
  createContext,
  useContext,
  type ComponentProps,
  type ReactNode,
} from "react";
import { CircleAlert, CircleCheck, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";

const CARD_CLASS =
  "gap-0 overflow-hidden rounded-[0.33em] border border-blue-100 bg-white py-0 shadow-sm";
const TRIGGER_CLASS =
  "cursor-pointer px-5 py-4 text-base font-semibold text-[#061858] hover:no-underline";
const CollapsibleCardGroupContext = createContext<"grouped" | "separate">(
  "grouped",
);

type CollapsibleCardGroupProps = ComponentProps<typeof Accordion> & {
  variant: "grouped" | "separate";
};

function CollapsibleCardGroup({
  variant,
  className,
  children,
  ...props
}: CollapsibleCardGroupProps) {
  return (
    <CollapsibleCardGroupContext.Provider value={variant}>
      <Accordion
        {...props}
        className={cn(
          variant === "grouped" ? CARD_CLASS : "space-y-4",
          className,
        )}
      >
        {children}
      </Accordion>
    </CollapsibleCardGroupContext.Provider>
  );
}

function CollapsibleCardSection({
  value,
  trigger,
  children,
  persistentContent,
  className,
  triggerClassName,
  contentClassName,
}: {
  value: string;
  trigger: ReactNode;
  children: ReactNode;
  persistentContent?: ReactNode;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
}) {
  const variant = useContext(CollapsibleCardGroupContext);

  return (
    <AccordionItem
      value={value}
      className={cn(
        variant === "separate" && "border-0",
        variant === "separate" && CARD_CLASS,
        className,
      )}
    >
      <AccordionTrigger className={cn(TRIGGER_CLASS, triggerClassName)}>
        {trigger}
      </AccordionTrigger>
      {persistentContent}
      <AccordionContent className={cn("pt-0 pb-0", contentClassName)}>
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}

function CollapsibleCardSectionTitle({
  icon: Icon,
  title,
  badge,
  requiredComplete,
}: {
  icon: LucideIcon;
  title: ReactNode;
  badge?: ReactNode;
  requiredComplete?: boolean;
}) {
  return (
    <span className="flex items-center gap-3">
      {requiredComplete === undefined ? (
        <Icon className="text-primary h-4 w-4" />
      ) : requiredComplete ? (
        <CircleCheck className="text-supportive h-5 w-5" />
      ) : (
        <CircleAlert className="text-destructive h-5 w-5" />
      )}
      {title}
      {badge}
    </span>
  );
}

function CollapsibleCard({
  id,
  title,
  icon,
  children,
  defaultOpen = false,
  className,
  triggerClassName,
  contentClassName,
}: {
  id: string;
  title: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={cn(CARD_CLASS, className)}>
      <Accordion
        type="single"
        collapsible
        defaultValue={defaultOpen ? id : undefined}
      >
        <AccordionItem value={id} className="border-0">
          <AccordionTrigger className={cn(TRIGGER_CLASS, triggerClassName)}>
            {icon ? (
              <span className="flex items-center gap-2">
                {icon}
                {title}
              </span>
            ) : (
              title
            )}
          </AccordionTrigger>
          <AccordionContent className={cn("pt-0 pb-0", contentClassName)}>
            {children}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}

export {
  CollapsibleCard,
  CollapsibleCardGroup,
  CollapsibleCardSection,
  CollapsibleCardSectionTitle,
};
