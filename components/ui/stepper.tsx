import { ChevronRight, CircleCheckBig } from "lucide-react";

import { cn } from "@/lib/utils";

type StepperStep = {
  title: string;
};

function Stepper({
  steps,
  currentStep,
  className,
}: {
  steps: StepperStep[];
  currentStep: number;
  className?: string;
}) {
  return (
    <nav
      aria-label="Form progress"
      className={cn("flex flex-wrap items-center gap-x-2 gap-y-2", className)}
    >
      {steps.map((step, index) => {
        const active = index === currentStep;
        const done = index < currentStep;

        return (
          <div key={step.title} className="flex items-center gap-2">
            <div
              className={cn(
                "flex min-w-0 items-center gap-1.5 text-sm font-medium",
                active
                  ? "text-primary"
                  : done
                    ? "text-supportive"
                    : "text-muted-foreground",
              )}
              aria-current={active ? "step" : undefined}
            >
              {done ? (
                <CircleCheckBig
                  className="text-supportive h-6 w-6 shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground",
                  )}
                >
                  <div className="mt-0.5">{index + 1}</div>
                </span>
              )}
              <span className="truncate">{step.title}</span>
            </div>
            {index < steps.length - 1 && (
              <ChevronRight
                className="text-muted-foreground h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}

export { Stepper, type StepperStep };
