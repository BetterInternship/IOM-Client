"use client";

import { type ReactNode } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Filter,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  ResourceFilterGroup,
  ResourceTableColumn,
  ResourceTableState,
} from "@/components/ui/use-resource-table";

export type { ResourceTableColumn } from "@/components/ui/use-resource-table";

type ResourceEmptyState = {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
};

function ResourceFilterPanel({
  groups,
  draftValue,
  draftActiveCount,
  toggleOption,
  toggleGroup,
  clearDraft,
  cancel,
  apply,
}: {
  groups: ResourceFilterGroup[];
  draftValue: Record<string, string[]>;
  draftActiveCount: number;
  toggleOption: (
    groupId: string,
    optionValue: string,
    checked: boolean,
  ) => void;
  toggleGroup: (groupId: string) => void;
  clearDraft: () => void;
  cancel: () => void;
  apply: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-3 py-2">
        <span className="text-sm font-semibold text-gray-900">Filters</span>
        {draftActiveCount > 0 && (
          <button
            type="button"
            onClick={clearDraft}
            className="shrink-0 text-sm font-medium text-gray-600 hover:text-primary"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {groups.map((group) => {
          const activeValues = draftValue[group.id] ?? [];
          const allSelected = activeValues.length === group.options.length;

          return (
            <section
              key={group.id}
              className="overflow-hidden rounded-[0.33em] border border-gray-200 bg-white"
            >
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5">
                <span className="text-sm font-semibold text-gray-800">
                  {group.label}
                </span>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="text-sm font-medium text-gray-600 hover:text-primary"
                >
                  {allSelected ? "Clear" : "Select all"}
                </button>
              </div>
              {group.options.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-50 active:bg-gray-100"
                >
                  <span className="flex-1">{option.label}</span>
                  {typeof option.count === "number" && (
                    <span className="text-muted-foreground">
                      {option.count}
                    </span>
                  )}
                  <Checkbox
                    checked={activeValues.includes(option.value)}
                    onCheckedChange={(checked) =>
                      toggleOption(group.id, option.value, checked === true)
                    }
                  />
                </label>
              ))}
            </section>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-2 border-t bg-white px-3 py-2.5">
        <Button variant="outline" onClick={cancel}>
          Cancel
        </Button>
        <Button onClick={apply}>Apply</Button>
      </div>
    </>
  );
}

export function ResourceTable<TData>({
  table,
  columns = table.columns,
  renderMobileRow,
  emptyState,
  noResultsState,
  rowLabelSingular,
  rowLabelPlural,
  className,
  contentClassName,
  listClassName,
  paginationClassName,
  toolbarLeading,
  onRowClick,
  getRowClassName,
}: {
  table: ResourceTableState<TData>;
  columns?: Array<ResourceTableColumn<TData>>;
  renderMobileRow: (row: TData) => ReactNode;
  emptyState: ResourceEmptyState;
  noResultsState?: ResourceEmptyState;
  rowLabelSingular: string;
  rowLabelPlural: string;
  className?: string;
  contentClassName?: string;
  listClassName?: string;
  paginationClassName?: string;
  toolbarLeading?: ReactNode;
  onRowClick?: (row: TData) => void;
  getRowClassName?: (row: TData) => string | undefined;
}) {
  const hasToolbar = !!toolbarLeading || !!table.search || !!table.filters;
  const hasRows = table.pagedRows.length > 0;
  const hasAnyData = table.dataCount > 0;
  const hasDesktopTable = !!columns?.length;
  const resolvedEmptyState = hasAnyData
    ? (noResultsState ?? emptyState)
    : emptyState;

  const renderHeaderCell = (column: ResourceTableColumn<TData>) => {
    const sortColumn = table.sort?.columns.find(
      (item) => item.id === column.id,
    );
    const isSortable =
      !!table.sort && column.sortable !== false && !!sortColumn;
    const isActive = table.sort?.column === column.id;
    const isDesc = isActive && table.sort?.direction === "desc";

    return (
      <th
        key={column.id}
        className={cn(
          "px-5 py-3 font-medium",
          column.align === "center" && "text-center",
          column.align === "right" && "text-right",
          column.width,
        )}
      >
        {isSortable ? (
          <button
            type="button"
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 text-left hover:text-gray-900",
              column.align === "center" && "justify-center",
              column.align === "right" && "justify-end",
              isActive && "text-primary",
            )}
            onClick={() =>
              table.sort?.setSort(column.id, column.defaultSortDirection)
            }
          >
            {column.header}
            {isDesc ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : isActive ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronsUpDown className="text-muted-foreground/60 h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          column.header
        )}
      </th>
    );
  };

  return (
    <div className={cn("space-y-5", className)}>
      {hasToolbar && (
        <div className="flex flex-wrap items-center gap-2">
          {table.filters && (
            <Popover
              open={table.filters.open}
              onOpenChange={table.filters.setOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    "relative h-11 w-11 shrink-0 border-gray-200 bg-white text-gray-600 hover:text-primary",
                    table.filters.activeCount > 0 && "text-primary",
                  )}
                  aria-label="Filter results"
                  aria-expanded={table.filters.open}
                >
                  <Filter />
                  {table.filters.activeCount > 0 && (
                    <span className="bg-primary text-primary-foreground absolute top-0 right-0 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold">
                      {table.filters.activeCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                sideOffset={6}
                className="flex max-h-[70vh] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[0.33em] border border-gray-200 bg-white p-0 shadow-lg sm:w-[445px]"
              >
                <ResourceFilterPanel
                  groups={table.filters.groups}
                  draftValue={table.filters.draftValue}
                  draftActiveCount={table.filters.draftActiveCount}
                  toggleOption={table.filters.toggleDraftOption}
                  toggleGroup={table.filters.toggleDraftGroup}
                  clearDraft={table.filters.clearDraft}
                  cancel={table.filters.cancel}
                  apply={table.filters.apply}
                />
              </PopoverContent>
            </Popover>
          )}

          {table.search && (
            <div className="relative w-full max-w-xl">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 z-20 h-4 w-4 -translate-y-1/2" />
              <input
                type="search"
                value={table.search.value}
                onChange={(event) => table.search?.setValue(event.target.value)}
                placeholder={table.search.placeholder}
                aria-label={table.search.ariaLabel}
                className="placeholder:text-muted-foreground/60 focus:border-primary h-11 w-full rounded-[0.33em] border border-gray-200 bg-white pr-4 pl-11 text-sm outline-none transition-colors focus:ring-2 focus:ring-primary/10"
              />
            </div>
          )}

          {toolbarLeading}
        </div>
      )}

      {hasRows ? (
        <div
          className={cn(
            "overflow-hidden rounded-[0.33em] border border-gray-200 bg-white",
            contentClassName,
          )}
        >
          {hasDesktopTable && (
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full table-fixed border-collapse text-left">
                <thead className="bg-gray-50 text-sm font-medium text-gray-700">
                  <tr className="border-b border-gray-200">
                    {columns.map(renderHeaderCell)}
                  </tr>
                </thead>
                <tbody>
                  {table.pagedRows.map((row) => (
                    <tr
                      key={table.getRowId(row)}
                      className={cn(
                        "group border-b border-gray-200 transition-colors last:border-b-0 hover:bg-primary/[0.035] focus-within:bg-primary/[0.035]",
                        onRowClick && "cursor-pointer",
                        getRowClassName?.(row),
                      )}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                    >
                      {columns.map((column) => (
                        <td
                          key={column.id}
                          className={cn(
                            "px-5 py-4",
                            column.align === "center" && "text-center",
                            column.align === "right" && "text-right",
                          )}
                        >
                          {column.render(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div
            className={cn(
              "divide-y divide-gray-200",
              hasDesktopTable && "md:hidden",
              listClassName,
            )}
          >
            {table.pagedRows.map((row) => (
              <div key={table.getRowId(row)}>{renderMobileRow(row)}</div>
            ))}
          </div>

          <div
            className={cn(
              "flex flex-col items-center justify-between gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row",
              paginationClassName,
            )}
          >
            <p className="text-muted-foreground text-sm">
              Showing {table.pageStart + 1} to {table.pageEnd} of{" "}
              {table.totalCount}{" "}
              {table.totalCount === 1 ? rowLabelSingular : rowLabelPlural}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <label className="text-muted-foreground flex items-center gap-2 text-sm whitespace-nowrap">
                Rows per page
                <Select
                  value={String(table.pagination.pageSize)}
                  onValueChange={(value) =>
                    table.pagination.setPageSize(Number(value))
                  }
                >
                  <SelectTrigger className="w-20" aria-label="Rows per page">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {table.pagination.pageSizeOptions.map((pageSize) => (
                      <SelectItem key={pageSize} value={String(pageSize)}>
                        {pageSize}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              {table.pageCount > 1 && (
                <div
                  className="flex items-center gap-1"
                  aria-label="Pagination"
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={table.page === 1}
                    onClick={() => table.pagination.setPage(table.page - 1)}
                    aria-label="Previous page"
                  >
                    <ChevronLeft />
                  </Button>
                  {Array.from(
                    { length: table.pageCount },
                    (_, index) => index + 1,
                  )
                    .filter(
                      (page) =>
                        page === 1 ||
                        page === table.pageCount ||
                        Math.abs(page - table.page) <= 1,
                    )
                    .map((page, index, pages) => (
                      <span key={page} className="flex items-center gap-1">
                        {index > 0 && page - pages[index - 1] > 1 && (
                          <span className="text-muted-foreground px-1">
                            ...
                          </span>
                        )}
                        <Button
                          variant={page === table.page ? "outline" : "ghost"}
                          scheme={page === table.page ? "primary" : undefined}
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => table.pagination.setPage(page)}
                          aria-label={`Page ${page}`}
                          aria-current={
                            page === table.page ? "page" : undefined
                          }
                        >
                          {page}
                        </Button>
                      </span>
                    ))}
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={table.page === table.pageCount}
                    onClick={() => table.pagination.setPage(table.page + 1)}
                    aria-label="Next page"
                  >
                    <ChevronRight />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-[0.33em] border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-gray-700">
            {resolvedEmptyState.title}
          </p>
          {resolvedEmptyState.description && (
            <p className="text-muted-foreground mt-1 text-sm">
              {resolvedEmptyState.description}
            </p>
          )}
          {resolvedEmptyState.action && (
            <div className="mt-4">{resolvedEmptyState.action}</div>
          )}
        </div>
      )}
    </div>
  );
}
