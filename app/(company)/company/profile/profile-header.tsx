import { Loader2, Pencil } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ProfileHeaderProps = {
  companyName: string;
  isSetupMode: boolean;
  isEditing: boolean;
  companyInfoComplete: boolean;
  documentsComplete: boolean;
  isSaveDisabled: boolean;
  isSaving: boolean;
  onEdit: () => void;
  onSave: () => void;
};

export function ProfileHeader({
  companyName,
  isSetupMode,
  isEditing,
  companyInfoComplete,
  documentsComplete,
  isSaveDisabled,
  isSaving,
  onEdit,
  onSave,
}: ProfileHeaderProps) {
  if (!isSetupMode) {
    return (
      <div className="flex items-start justify-between gap-4">
        <PageHeader title={companyName} />
        {isEditing ? (
          <Button onClick={onSave} disabled={isSaveDisabled}>
            {isSaving && <Loader2 className="animate-spin" />}
            Save changes
          </Button>
        ) : (
          <Button variant="outline" onClick={onEdit}>
            <Pencil /> Edit
          </Button>
        )}
      </div>
    );
  }

  const steps = [companyInfoComplete, documentsComplete];
  const remainingSteps = steps.filter((complete) => !complete).length;

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
        You&apos;re almost ready to request MOAs!
      </h1>
      <div className="w-full max-w-sm space-y-3 sm:w-80">
        <p className="text-sm font-medium text-gray-700">
          {remainingSteps} required {remainingSteps === 1 ? "step" : "steps"}{" "}
          remaining
        </p>
        <div
          className="flex gap-1.5"
          aria-label={`${steps.length - remainingSteps} of ${steps.length} setup steps completed`}
        >
          {steps.map((complete, index) => (
            <span
              key={index}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                complete ? "bg-primary" : "bg-gray-200",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
