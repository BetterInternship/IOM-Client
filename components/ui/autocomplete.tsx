"use client";
import { useState, useEffect, useRef } from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

interface AutocompleteOption<ID extends number | string> {
  id: ID;
  name: string;
}

export function Autocomplete<ID extends number | string>({
  options,
  value,
  onChange,
  placeholder,
  className,
  inputClassName,
}: {
  options: AutocompleteOption<ID>[];
  value?: ID | null;
  onChange: (value: ID | null) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<AutocompleteOption<ID> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const match = options.find((o) => o.id === value) ?? null;
    setSelected(match);
  }, [value, options]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query
    ? options.filter((o) => o.name.toUpperCase().includes(query))
    : options;

  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <Input
        value={selected?.name ?? query}
        placeholder={placeholder}
        className={inputClassName}
        onChange={(e) => {
          setQuery(e.target.value.toUpperCase());
          setSelected(null);
          onChange(null);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
      />
      {isOpen && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto overscroll-contain rounded-[0.33em] border border-gray-200 bg-white p-1 text-sm shadow-lg">
          {sorted.length ? (
            sorted.map((option) => (
              <li
                key={String(option.id)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setSelected(option);
                  setQuery("");
                  onChange(option.id);
                  setIsOpen(false);
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center rounded-[0.33em] px-2.5 py-1.5 text-left text-sm transition-colors",
                  selected?.id === option.id
                    ? "bg-primary/10 text-primary"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                {option.name}
              </li>
            ))
          ) : (
            <li className="px-2.5 py-1.5 text-sm text-gray-400">
              No matching results.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
