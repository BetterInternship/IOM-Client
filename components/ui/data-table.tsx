"use client";

import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
  ColumnFiltersState,
  ColumnSizingState,
  VisibilityState,
  Updater,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Reusable table shell used by registry screens.
 * Provides consistent filtering, sorting, column visibility, selection, and pagination UX.
 */
interface DataTableProps<TData, TValue> {
  /** Stable table id used for DOM identity and persisted table preferences. */
  id: string;
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Optional: which column(s) to bind the top search box to (e.g., "company") */
  searchLabel?: string;
  /** single key or multiple keys to search across */
  searchKey?: string | string[];
  /** Optional: show the search bar (default: true) */
  enableSearch?: boolean;
  /** Optional: show column visibility menu (default: true) */
  enableColumnVisibility?: boolean;
  /** Optional: enable row selection with checkboxes (default: false) */
  enableRowSelection?: boolean;
  /** Optional: initial sorting state */
  initialSorting?: SortingState;
  /** Optional: persist sorting state in localStorage under this key */
  sortingStorageKey?: string;
  /** Optional: right-side toolbar slot (e.g., extra buttons) */
  toolbarActions?: React.ReactNode;
  /** Optional: override the search input placeholder */
  searchPlaceholder?: string;
  /** Optional: labels used in the pagination row count */
  rowLabelSingular?: string;
  rowLabelPlural?: string;
  /** Optional: className for wrapper */
  className?: string;
  onSelectionChange?: (rows: TData[]) => void;
  /** Optional: callback invoked when a data row is clicked */
  onRowClick?: (row: TData) => void;
  /** Optional: return extra Tailwind classes for a given row (overrides default even/odd bg) */
  getRowClassName?: (row: TData, index: number) => string | undefined;
}

function TruncatedCellValue({
  children,
  tooltip,
}: {
  children: React.ReactNode;
  tooltip?: string;
}) {
  const textRef = React.useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = React.useState(false);

  React.useEffect(() => {
    const element = textRef.current;
    if (!element) return;

    const checkTruncation = () => {
      setIsTruncated(element.scrollWidth > element.clientWidth);
    };

    checkTruncation();

    const resizeObserver = new ResizeObserver(checkTruncation);
    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, [children]);

  const content = (
    <div ref={textRef} className="min-w-0 truncate px-1.5">
      {children}
    </div>
  );

  if (!tooltip || !isTruncated) return content;

  return (
    <Tooltip delayDuration={700}>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent
        arrowClassName="fill-white"
        className="max-w-xs border border-gray-200 bg-white px-2 py-1 text-xs font-normal text-gray-400 shadow-sm"
        side="top"
        sideOffset={1}
      >
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function getCellTooltipText(value: unknown) {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

function readStoredState<TValue>(storageKey: string, fallback: TValue) {
  if (typeof window === "undefined") return fallback;

  try {
    return JSON.parse(localStorage.getItem(storageKey) || "") || fallback;
  } catch {
    return fallback;
  }
}

function writeStoredState<TValue>(storageKey: string, value: TValue) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Keep table interactions usable even when storage is unavailable.
  }
}

export function DataTable<TData, TValue>({
  id,
  columns,
  data,
  searchLabel,
  searchKey,
  enableSearch = true,
  enableColumnVisibility = false,
  enableRowSelection = false,
  initialSorting,
  sortingStorageKey,
  toolbarActions,
  searchPlaceholder = "Search forms...",
  rowLabelSingular = "form",
  rowLabelPlural = "forms",
  className,
  onRowClick,
  getRowClassName,
}: DataTableProps<TData, TValue>) {
  const columnSizingStorageKey = React.useMemo(() => `data-table:${id}:column-sizing`, [id]);

  const [sorting, setSorting] = React.useState<SortingState>(() => {
    if (!sortingStorageKey) return initialSorting ?? [];

    return readStoredState(sortingStorageKey, initialSorting ?? []);
  });
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>(() =>
    readStoredState(columnSizingStorageKey, {})
  );
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({} as Record<string, boolean>);
  const [globalFilter, setGlobalFilter] = React.useState("");

  const handleSortingChange = React.useCallback(
    (updater: Updater<SortingState>) => {
      setSorting((currentSorting) => {
        const nextSorting = typeof updater === "function" ? updater(currentSorting) : updater;

        if (sortingStorageKey) {
          writeStoredState(sortingStorageKey, nextSorting);
        }

        return nextSorting;
      });
    },
    [sortingStorageKey]
  );

  const handleColumnSizingChange = React.useCallback(
    (updater: Updater<ColumnSizingState>) => {
      setColumnSizing((currentSizing) => {
        const nextSizing = typeof updater === "function" ? updater(currentSizing) : updater;
        writeStoredState(columnSizingStorageKey, nextSizing);
        return nextSizing;
      });
    },
    [columnSizingStorageKey]
  );

  React.useEffect(() => {
    setColumnSizing(readStoredState(columnSizingStorageKey, {}));
  }, [columnSizingStorageKey]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnSizing,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    columnResizeMode: "onChange",
    defaultColumn: {
      size: 192,
      minSize: 80,
      maxSize: 720,
    },
    enableRowSelection, // enables internal selection state
    onSortingChange: handleSortingChange,
    onColumnSizingChange: handleColumnSizingChange,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue) => {
      const query = String(filterValue ?? "")
        .toLowerCase()
        .trim();
      if (!query) return true;

      return row.getAllCells().some((cell) => {
        const value = cell.getValue();
        if (value == null) return false;
        return String(value).toLowerCase().includes(query);
      });
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    // Keep page size stable across renders
    initialState: { pagination: { pageSize: 20 } },
  });

  const searchKeys = React.useMemo(() => {
    if (!searchKey) return [] as string[];
    return Array.isArray(searchKey) ? searchKey : [searchKey];
  }, [searchKey]);

  // Allow user to pick a single column to search. Default to first provided searchKey
  const [selectedSearchKey, setSelectedSearchKey] = React.useState<string>(searchKeys[0] ?? "");

  React.useEffect(() => {
    if (searchKeys.length) {
      setSelectedSearchKey(searchKeys[0]);
      return;
    }

    // If no searchKey prop provided, default to first filterable column when table is ready
    const first = table.getAllLeafColumns().find((c) => c.getCanFilter() !== false);
    if (first) setSelectedSearchKey(first.id);
  }, [JSON.stringify(searchKeys), table]);

  const effectiveSearchKeys = React.useMemo(() => {
    return selectedSearchKey ? [selectedSearchKey] : searchKeys;
  }, [selectedSearchKey, searchKeys]);

  const filteredRowCount = table.getFilteredRowModel().rows.length;
  // Keep index column width in px so tableWidthPx can be an exact sum — no
  // leftover space for table-fixed to redistribute into this column.
  const INDEX_COL_W = Math.max(52, String(Math.max(filteredRowCount, 1)).length * 10 + 32);
  const indexColumnStyle: React.CSSProperties = {
    width: INDEX_COL_W,
    minWidth: INDEX_COL_W,
    maxWidth: INDEX_COL_W,
  };
  const extraWidthPx = (enableRowSelection ? 42 : 0) + INDEX_COL_W;
  const tableMinWidthPx =
    table.getVisibleLeafColumns().reduce((sum, col) => sum + (col.columnDef.minSize ?? 80), 0) +
    extraWidthPx;
  // Exact sum of all columns — avoids distributing leftover space to the index column.
  const tableWidthPx = Math.max(tableMinWidthPx, table.getTotalSize() + extraWidthPx);
  const { pageIndex, pageSize } = table.getState().pagination;

  return (
    <div id={id} className={cn("flex min-h-0 flex-col gap-3", className)}>
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex w-full items-stretch gap-2 sm:w-auto">
          {enableColumnVisibility && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 gap-2">
                  <SlidersHorizontal className="mt-0.5 h-4 w-4" />
                  View
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {table
                  .getAllLeafColumns()
                  .filter((col) => col.getCanHide())
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(checked) => column.toggleVisibility(!!checked)}
                    >
                      {String(column.columnDef.header ?? column.id)}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {enableSearch && effectiveSearchKeys.length > 0 && (
            <div className="flex items-center gap-2">
              <Input
                placeholder={searchPlaceholder}
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="h-10 w-full sm:w-96"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">{toolbarActions}</div>
      </div>

      {/* Table + Pagination — share a merged border */}
      <div className="flex flex-col">
      <div className="relative h-[480px] overflow-hidden rounded-t-sm border border-b-0 border-gray-200 [&_[data-slot=table-container]]:h-full [&_[data-slot=table-container]]:overflow-auto">
        <div
          className="pointer-events-none absolute top-0 left-0 z-[25] h-10 w-16 bg-gradient-to-r from-gray-200 to-transparent"
        />
        <div
          className="pointer-events-none absolute top-10 bottom-0 z-[5] w-px bg-gray-200"
          style={{ left: INDEX_COL_W - 1 }}
        />
        <Table
          className="table-fixed"
          style={{ minWidth: `${tableMinWidthPx}px`, width: `max(100%, ${tableWidthPx}px)` }}
        >
          <colgroup>
            <col style={indexColumnStyle} />
            {enableRowSelection && <col style={{ width: 42, minWidth: 42, maxWidth: 42 }} />}
            {table.getVisibleLeafColumns().map((column) => (
              <col key={column.id} style={{ width: column.getSize() }} />
            ))}
            {/* filler col: absorbs leftover space so the index column stays fixed */}
            <col />
          </colgroup>
          <TableHeader className="[&_tr]:border-b-0">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                <TableHead
                  className="sticky top-0 left-0 z-30 bg-gray-200 pr-2 text-right text-gray-700"
                  style={indexColumnStyle}
                ></TableHead>
                {enableRowSelection && (
                  <TableHead className="sticky top-0 z-20 w-[42px] bg-gray-200">
                    <Checkbox
                      checked={
                        table.getIsAllPageRowsSelected() ||
                        (table.getIsSomePageRowsSelected() && "indeterminate")
                      }
                      onCheckedChange={(val) => table.toggleAllPageRowsSelected(!!val)}
                      aria-label="Select all"
                    />
                  </TableHead>
                )}
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      "group font-heading sticky top-0 z-20 max-w-0 bg-gray-200 tracking-tight text-gray-700 transition-colors duration-300",
                      header.column.getCanSort() && "cursor-pointer select-none hover:bg-gray-300",
                      header.column.getIsSorted() && "hover:bg-gray-300"
                    )}
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className="flex min-w-0 items-center justify-between gap-2"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex min-w-0 items-center gap-1">
                          <span
                            className={cn(
                              "font-semibold min-w-0 truncate rounded px-1.5 py-0.5 transition-colors duration-300",
                              header.column.getIsSorted() && "text-gray-900"
                            )}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </span>
                          {header.column.getCanSort() && !header.column.getIsSorted() && (
                            <ChevronsUpDown className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                          )}
                          {header.column.getIsSorted() === "asc" && (
                            <ChevronUp className="mt-0.5 h-4 w-4 shrink-0 text-gray-600" />
                          )}
                          {header.column.getIsSorted() === "desc" && (
                            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-gray-600" />
                          )}
                        </div>
                        <span
                          className={cn(
                            "mr-2 h-3 w-3 shrink-0 rounded-full bg-gray-500 transition-all duration-300 ease-out",
                            header.column.getIsSorted()
                              ? "scale-100 opacity-100"
                              : "scale-50 opacity-0"
                          )}
                          aria-hidden="true"
                        />
                      </div>
                    )}
                    {header.column.getCanResize() && (
                      <div
                        className="absolute top-0 right-0 z-30 h-full w-3 translate-x-1/2 cursor-col-resize touch-none select-none"
                        onClick={(event) => event.stopPropagation()}
                        onMouseDown={(event) => {
                          event.stopPropagation();
                          header.getResizeHandler()(event);
                        }}
                        onTouchStart={(event) => {
                          event.stopPropagation();
                          header.getResizeHandler()(event);
                        }}
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Resize ${String(header.column.columnDef.header ?? header.column.id)} column`}
                      >
                        <span
                          className={cn(
                            "bg-primary/70 absolute top-2 bottom-2 left-1/2 w-0.5 -translate-x-1/2 rounded-full opacity-0 transition-opacity group-hover:opacity-60 hover:opacity-100",
                            header.column.getIsResizing() && "opacity-100"
                          )}
                        />
                      </div>
                    )}
                  </TableHead>
                ))}
                <TableHead className="sticky top-0 z-20 bg-gray-200" />
              </TableRow>
            ))}
          </TableHeader>

          <TableBody className="[&_tr:last-child]:!border-b">
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row, rowIndex) => {
                const rowCustomClass = getRowClassName?.(row.original, rowIndex);
                const defaultRowBg = rowIndex % 2 === 0 ? "bg-white" : "bg-muted/40";
                const stickyBg = row.getIsSelected()
                  ? "bg-muted"
                  : rowCustomClass
                    ? rowCustomClass
                    : rowIndex % 2 === 0
                      ? "bg-white"
                      : "bg-gray-50";
                return (
                <TableRow
                  className={cn(
                    "group hover:bg-primary/10",
                    rowCustomClass ?? defaultRowBg,
                    onRowClick && "cursor-pointer"
                  )}
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                >
                  <TableCell
                    className={cn(
                      "text-muted-foreground sticky left-0 z-10 pr-2 text-right font-medium shadow-[inset_-2px_0_0_theme(colors.gray.200)]",
                      stickyBg
                    )}
                    style={indexColumnStyle}
                  >
                    <span
                      className="absolute top-1/2 left-1.5 ml-1 h-2.5 w-2.5 -translate-y-1/2 scale-50 rounded-full bg-gray-400 opacity-0 transition-all duration-300 ease-out group-hover:scale-100 group-hover:opacity-100"
                      aria-hidden="true"
                    />
                    <span>{pageIndex * pageSize + rowIndex + 1}</span>
                  </TableCell>
                  {enableRowSelection && (
                    <TableCell className="w-[42px]">
                      <Checkbox
                        checked={row.getIsSelected()}
                        onCheckedChange={(val) => row.toggleSelected(!!val)}
                        aria-label="Select row"
                      />
                    </TableCell>
                  )}
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="max-w-0"
                      style={{ width: cell.column.getSize() }}
                    >
                      <TruncatedCellValue tooltip={getCellTooltipText(cell.getValue())}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TruncatedCellValue>
                    </TableCell>
                  ))}
                  <TableCell className="p-0" />
                </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length + (enableRowSelection ? 1 : 0) + 2}
                  className="h-24 px-1.5 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="z-10 flex shrink-0 flex-col items-center justify-between gap-1 rounded-b-sm border border-gray-200 bg-white px-3 py-2 sm:flex-row">
        <div className="text-muted-foreground px-1.5 text-sm">
          {table.getFilteredRowModel().rows.length}{" "}
          {table.getFilteredRowModel().rows.length === 1 ? rowLabelSingular : rowLabelPlural}
        </div>

        {table.getPageCount() > 1 && (
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-1 text-sm">
                Page {table.getState().pagination.pageIndex + 1} {""}
                of {table.getPageCount()}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
