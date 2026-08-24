"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Free-text email field that suggests the university's account emails as the
 * user types. Selecting a suggestion fills the input; any valid email can still
 * be typed manually. Renders the card-style label/input/error block used by the
 * university signatory editor.
 */
export function SignatoryEmailInput({
  id,
  value,
  onChange,
  suggestions,
  error,
  required = false,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  error?: string;
  required?: boolean;
}) {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQuery(value), [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = suggestions
    .filter((email) => email.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 6);

  return (
    <div className="relative space-y-1" ref={containerRef}>
      <Label className="text-sm" htmlFor={id}>
        Email{" "}
      </Label>
      <Input
        id={id}
        type="email"
        required={required}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="name@university.edu.ph"
      />
      {error && <p className="text-destructive text-xs">{error}</p>}
      {isOpen && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-[0.33em] border border-slate-200 bg-white shadow-md">
          {filtered.map((email) => (
            <li key={email}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setQuery(email);
                  onChange(email);
                  setIsOpen(false);
                }}
                className="w-full cursor-pointer truncate px-3 py-1.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
              >
                {email}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
