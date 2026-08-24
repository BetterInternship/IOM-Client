import { Eye, FileText, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";

function TemplatePreviewRow({
  name,
  termMonths,
  onPreview,
  onChange,
  compact = false,
}: {
  name: string;
  termMonths?: number | null;
  onPreview: () => void;
  onChange?: () => void;
  compact?: boolean;
}) {
  if (!onChange && !compact) {
    return (
      <Button
        type="button"
        variant="ghost"
        onClick={onPreview}
        className="group h-auto w-full justify-start gap-4 rounded-none px-0 py-6 text-left whitespace-normal hover:bg-transparent hover:text-gray-700"
      >
        <span className="bg-primary/5 text-primary flex size-14 shrink-0 items-center justify-center rounded-full">
          <FileText className="!size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 text-left">
          <p className="mt-1 font-semibold text-[#121d3d]">{name}</p>
          {termMonths !== undefined && (
            <p className="text-muted-foreground mt-1 text-sm">
              {termMonths == null ? "No expiry" : `${termMonths} months`}
            </p>
          )}
        </div>
        <span className="flex h-8 shrink-0 items-center gap-2 rounded-[0.33em] border border-gray-300 px-3 text-sm text-gray-700 transition-colors group-hover:bg-accent">
          <Eye aria-hidden="true" />
          Preview
        </span>
      </Button>
    );
  }

  return (
    <div
      className={`flex w-full items-center text-left ${compact ? "gap-3 py-3" : "gap-4 py-6"}`}
    >
      <span
        className={`bg-primary/5 text-primary flex shrink-0 items-center justify-center rounded-full ${compact ? "size-10" : "size-14"}`}
      >
        <FileText
          className={compact ? "!size-5" : "!size-6"}
          aria-hidden="true"
        />
      </span>
      <div className="min-w-0 flex-1 text-left">
        <p className="font-semibold text-[#121d3d]">{name}</p>
        {termMonths !== undefined && (
          <p className="text-muted-foreground mt-1 text-sm">
            {termMonths == null ? "No expiry" : `${termMonths} months`}
          </p>
        )}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {onChange && (
          <Button type="button" variant="ghost" onClick={onChange}>
            <Pencil aria-hidden="true" />
            Change
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onPreview}>
          <Eye aria-hidden="true" />
          Preview
        </Button>
      </div>
    </div>
  );
}

export { TemplatePreviewRow };
