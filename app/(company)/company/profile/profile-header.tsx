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
  onCancel: () => void;
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
  onCancel,
  onSave,
}: ProfileHeaderProps) {
  if (!isSetupMode) {
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title={companyName} />
        <div className="flex gap-2 sm:flex-none sm:justify-end">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                onClick={onCancel}
                disabled={isSaving}
                className="flex-1 sm:flex-none"
              >
                Cancel
              </Button>
              <Button
                onClick={onSave}
                disabled={isSaveDisabled}
                className="flex-1 sm:flex-none"
              >
                {isSaving && <Loader2 className="animate-spin" />}
                Save changes
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={onEdit} className="flex-1 sm:flex-none">
              <Pencil /> Edit
            </Button>
          )}
        </div>
      </div>
    );
  }

  // This page is one overall setup step. It is complete only when both
  // company information and required documents are complete.
  const steps = [companyInfoComplete && documentsComplete];
  const remainingSteps = steps.filter((complete) => !complete).length;

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
        You&apos;re almost ready to request MOAs!
      </h1>
      <div className="w-full max-w-sm space-y-3 sm:w-80">
        <p className="text-sm font-medium text-gray-700">
          {remainingSteps === 1 ? "One last step remaining" : "Ready to save"}
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
