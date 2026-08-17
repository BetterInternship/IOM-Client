"use client";

import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { format, parse } from "date-fns";

import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const DATE_FORMAT = "yyyy-MM-dd";
const INPUT_FORMAT = "MM/dd/yyyy";
const MIN_YEAR = 1900;
const MAX_YEAR = new Date().getFullYear() + 20;
const MONTHS = Array.from({ length: 12 }, (_, month) =>
  new Date(2000, month).toLocaleString("default", { month: "short" }),
);

type CalendarView = "days" | "months" | "years";

function parseDateValue(value?: string) {
  if (!value) return undefined;
  const parsed = parse(value, DATE_FORMAT, new Date());
  if (Number.isNaN(parsed.getTime())) return undefined;
  return format(parsed, DATE_FORMAT) === value ? parsed : undefined;
}

function formatInputValue(value?: string) {
  const date = parseDateValue(value);
  return date ? format(date, INPUT_FORMAT) : "";
}

function parseInputValue(value: string) {
  const parsed = parse(value, INPUT_FORMAT, new Date());
  if (Number.isNaN(parsed.getTime())) return undefined;
  if (format(parsed, INPUT_FORMAT) !== value) return undefined;
  const year = parsed.getFullYear();
  return year >= MIN_YEAR && year <= MAX_YEAR ? parsed : undefined;
}

function areInputPartsValid(parts: string[]) {
  const [month, day, year] = parts;
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  const yearNumber = Number(year);

  if (month.length === 2 && (monthNumber < 1 || monthNumber > 12)) return false;
  if (year.length === 4 && (yearNumber < MIN_YEAR || yearNumber > MAX_YEAR)) {
    return false;
  }

  if (day.length === 2) {
    if (dayNumber < 1) return false;
    const daysInMonth =
      month.length === 2
        ? new Date(year.length === 4 ? yearNumber : 2000, monthNumber, 0).getDate()
        : 31;
    if (dayNumber > daysInMonth) return false;
  }

  return true;
}

interface DatePickerProps {
  id?: string;
  value?: string;
  onChange: (value: string) => void;
  onValidityChange?: (isValid: boolean) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}

function DatePicker({
  value,
  id,
  onChange,
  onValidityChange,
  placeholder = "Select date",
  disabled,
  invalid,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(formatInputValue(value));
  const [inputInvalid, setInputInvalid] = React.useState(false);
  const selected = parseDateValue(value);
  const [month, setMonth] = React.useState(selected ?? new Date());
  const [view, setView] = React.useState<CalendarView>("days");
  const monthInputRef = React.useRef<HTMLInputElement>(null);
  const dayInputRef = React.useRef<HTMLInputElement>(null);
  const yearInputRef = React.useRef<HTMLInputElement>(null);
  const [yearPageStart, setYearPageStart] = React.useState(() =>
    MIN_YEAR + Math.floor(((selected ?? new Date()).getFullYear() - MIN_YEAR) / 12) * 12,
  );
  const [inputMonth = "", inputDay = "", inputYear = ""] = inputValue.split("/");

  React.useEffect(() => {
    setInputValue(formatInputValue(value));
    setInputInvalid(false);
    if (selected) setMonth(selected);
  }, [value]);

  const commitInput = () => {
    const next = inputValue.trim();
    const digits = next.replace(/\D/g, "");

    if (!digits) {
      setInputInvalid(false);
      onValidityChange?.(false);
      onChange("");
      return;
    }

    if (digits.length < 8) {
      setInputInvalid(false);
      onValidityChange?.(false);
      return;
    }

    const parsed = parseInputValue(next);
    if (!parsed) {
      setInputInvalid(true);
      onValidityChange?.(false);
      return;
    }

    setInputInvalid(false);
    setMonth(parsed);
    onValidityChange?.(true);
    onChange(format(parsed, DATE_FORMAT));
  };

  const openYearView = () => {
    setYearPageStart(
      MIN_YEAR + Math.floor((month.getFullYear() - MIN_YEAR) / 12) * 12,
    );
    setView("years");
  };

  const changeMonth = (offset: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    if (next.getFullYear() < MIN_YEAR || next.getFullYear() > MAX_YEAR) return;
    setMonth(next);
  };

  const canGoToPreviousMonth =
    month.getFullYear() > MIN_YEAR || month.getMonth() > 0;
  const canGoToNextMonth =
    month.getFullYear() < MAX_YEAR || month.getMonth() < 11;

  const inputRefs = [monthInputRef, dayInputRef, yearInputRef];
  const inputParts = [inputMonth, inputDay, inputYear];

  const updateInputPart = (index: number, rawValue: string) => {
    const maxLength = index === 2 ? 4 : 2;
    const nextParts = [...inputParts];
    nextParts[index] = rawValue.replace(/\D/g, "").slice(0, maxLength);
    if (!areInputPartsValid(nextParts)) return;
    const nextValue = nextParts.join("/");
    const parsed = parseInputValue(nextValue);
    setInputValue(nextValue);
    setInputInvalid(false);
    onValidityChange?.(!!parsed);
    if (parsed) onChange(format(parsed, DATE_FORMAT));

    if (nextParts[index].length === maxLength && index < 2) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleInputKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitInput();
    } else if (event.key === "/" && index < 2) {
      event.preventDefault();
      const nextParts = [...inputParts];
      if (nextParts[index]) nextParts[index] = nextParts[index].padStart(2, "0");
      if (!areInputPartsValid(nextParts)) return;
      setInputValue(nextParts.join("/"));
      inputRefs[index + 1].current?.focus();
    } else if (event.key === "Backspace" && !inputParts[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setView("days");
      }}
    >
      <div
        role="group"
        aria-label={placeholder}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) commitInput();
        }}
        onPaste={(event) => {
          const digits = event.clipboardData.getData("text").replace(/\D/g, "");
          if (digits.length !== 8) return;
          event.preventDefault();
          const pastedValue = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
          const parsed = parseInputValue(pastedValue);
          if (!parsed) return;
          setInputValue(pastedValue);
          setInputInvalid(false);
          onValidityChange?.(true);
          onChange(format(parsed, DATE_FORMAT));
          yearInputRef.current?.focus();
        }}
        className={cn(
          "bg-background relative z-10 box-border flex h-8 min-h-8 max-h-8 w-full items-center rounded-[0.33em] border border-gray-200 px-3 pr-10 text-sm focus-within:ring-transparent focus-within:outline-none",
          disabled && "cursor-not-allowed opacity-50",
          (invalid || inputInvalid) && "border-destructive",
          className,
        )}
      >
        <input
          ref={monthInputRef}
          id={id}
          value={inputMonth}
          onChange={(event) => updateInputPart(0, event.target.value)}
          onKeyDown={(event) => handleInputKeyDown(event, 0)}
          placeholder="MM"
          inputMode="numeric"
          disabled={disabled}
          aria-label="Month"
          aria-invalid={invalid || inputInvalid || undefined}
          className="placeholder:text-muted-foreground/40 w-7 bg-transparent text-center tabular-nums outline-none disabled:cursor-not-allowed"
        />
        <span className="text-muted-foreground px-1" aria-hidden="true">
          /
        </span>
        <input
          ref={dayInputRef}
          value={inputDay}
          onChange={(event) => updateInputPart(1, event.target.value)}
          onKeyDown={(event) => handleInputKeyDown(event, 1)}
          placeholder="DD"
          inputMode="numeric"
          disabled={disabled}
          aria-label="Day"
          aria-invalid={invalid || inputInvalid || undefined}
          className="placeholder:text-muted-foreground/40 w-7 bg-transparent text-center tabular-nums outline-none disabled:cursor-not-allowed"
        />
        <span className="text-muted-foreground px-1" aria-hidden="true">
          /
        </span>
        <input
          ref={yearInputRef}
          value={inputYear}
          onChange={(event) => updateInputPart(2, event.target.value)}
          onKeyDown={(event) => handleInputKeyDown(event, 2)}
          placeholder="YYYY"
          inputMode="numeric"
          disabled={disabled}
          aria-label="Year"
          aria-invalid={invalid || inputInvalid || undefined}
          className="placeholder:text-muted-foreground/40 w-10 bg-transparent text-center tabular-nums outline-none disabled:cursor-not-allowed"
        />
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label="Open calendar"
            className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 z-20 flex w-10 items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CalendarDays className="h-4 w-4 opacity-70" />
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent
        className="z-[1100] w-auto overflow-hidden p-0"
        align="start"
        sideOffset={6}
      >
        <div className="w-[276px] p-3">
          {view === "days" && (
            <>
              <div className="flex h-8 items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  disabled={!canGoToPreviousMonth}
                  onClick={() => changeMonth(-1)}
                  aria-label="Previous month"
                >
                  <ChevronLeft />
                </Button>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 px-2"
                    onClick={() => setView("months")}
                  >
                    {month.toLocaleString("default", { month: "long" })}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 px-2"
                    onClick={openYearView}
                  >
                    {month.getFullYear()}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  disabled={!canGoToNextMonth}
                  onClick={() => changeMonth(1)}
                  aria-label="Next month"
                >
                  <ChevronRight />
                </Button>
              </div>
              <Calendar
                mode="single"
                selected={selected}
                month={month}
                onMonthChange={setMonth}
                onSelect={(date) => {
                  const next = date ? format(date, DATE_FORMAT) : "";
                  setInputValue(date ? format(date, INPUT_FORMAT) : "");
                  setInputInvalid(false);
                  onValidityChange?.(!!date);
                  onChange(next);
                  setOpen(false);
                }}
                hideNavigation
                className="p-0 pt-3"
                classNames={{ month_caption: "hidden" }}
                startMonth={new Date(MIN_YEAR, 0)}
                endMonth={new Date(MAX_YEAR, 11)}
              />
            </>
          )}

          {view === "months" && (
            <>
              <div className="flex h-8 items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 w-8 px-0"
                  disabled={month.getFullYear() <= MIN_YEAR}
                  onClick={() =>
                    setMonth(new Date(month.getFullYear() - 1, month.getMonth(), 1))
                  }
                  aria-label="Previous year"
                >
                  <ChevronLeft />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 px-3"
                  onClick={openYearView}
                >
                  {month.getFullYear()}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  disabled={month.getFullYear() >= MAX_YEAR}
                  onClick={() =>
                    setMonth(new Date(month.getFullYear() + 1, month.getMonth(), 1))
                  }
                  aria-label="Next year"
                >
                  <ChevronRight />
                </Button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {MONTHS.map((label, monthIndex) => (
                  <Button
                    key={label}
                    type="button"
                    variant={
                      month.getMonth() === monthIndex ? "default" : "outline"
                    }
                    className="h-10"
                    onClick={() => {
                      setMonth(new Date(month.getFullYear(), monthIndex, 1));
                      setView("days");
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </>
          )}

          {view === "years" && (
            <>
              <div className="flex h-8 items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  disabled={yearPageStart <= MIN_YEAR}
                  onClick={() => setYearPageStart((year) => year - 12)}
                  aria-label="Previous years"
                >
                  <ChevronLeft />
                </Button>
                <span className="text-sm font-medium">
                  {yearPageStart}-{Math.min(yearPageStart + 11, MAX_YEAR)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  disabled={yearPageStart + 11 >= MAX_YEAR}
                  onClick={() => setYearPageStart((year) => year + 12)}
                  aria-label="Next years"
                >
                  <ChevronRight />
                </Button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {Array.from({ length: 12 }, (_, index) => yearPageStart + index).map(
                  (year) => (
                    <Button
                      key={year}
                      type="button"
                      variant={
                        month.getFullYear() === year ? "default" : "outline"
                      }
                      className="h-10"
                      disabled={year > MAX_YEAR}
                      onClick={() => {
                        setMonth(new Date(year, month.getMonth(), 1));
                        setView("months");
                      }}
                    >
                      {year}
                    </Button>
                  ),
                )}
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { DatePicker };
