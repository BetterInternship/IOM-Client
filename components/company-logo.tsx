import { cn } from "@/lib/utils";

function companyInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function CompanyLogo({
  name,
  logoUrl,
  className,
  imageClassName,
}: {
  name: string;
  logoUrl?: string | null;
  className?: string;
  imageClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 text-lg font-semibold text-gray-600",
        className,
      )}
    >
      {logoUrl ? (
        // Company logos are user-uploaded external assets.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={`${name} logo`}
          className={cn("size-full object-contain p-2", imageClassName)}
        />
      ) : (
        <span aria-hidden="true">{companyInitials(name)}</span>
      )}
    </div>
  );
}

export { CompanyLogo };
