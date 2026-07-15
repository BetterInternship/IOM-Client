import { useMemo, useState, type ReactNode } from "react";

export type ResourceSortDirection = "asc" | "desc";
export type ResourceSortValue = string | number | Date | null | undefined;
export type ResourceFilterValue = Record<string, string[]>;

export type ResourceFilterOption = {
  value: string;
  label: string;
  count?: number;
};

export type ResourceFilterGroup = {
  id: string;
  label: string;
  options: ResourceFilterOption[];
};

export type ResourceTableColumn<TData> = {
  id: string;
  header: ReactNode;
  width?: string;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  defaultSortDirection?: ResourceSortDirection;
  getSortValue?: (row: TData) => ResourceSortValue;
  render: (row: TData) => ReactNode;
};

export type ResourceSortColumn<TData> = {
  id: string;
  getValue: (row: TData) => ResourceSortValue;
  defaultDirection?: ResourceSortDirection;
};

export type ResourceTableState<TData> = ReturnType<
  typeof useResourceTable<TData>
>;

function countActiveFilters(value: ResourceFilterValue) {
  return Object.values(value).reduce(
    (total, values) => total + values.length,
    0,
  );
}

function sameStringSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

function getColumnSorts<TData>(columns: Array<ResourceTableColumn<TData>>) {
  return columns.flatMap((column): Array<ResourceSortColumn<TData>> => {
    if (column.sortable === false || !column.getSortValue) return [];
    return [
      {
        id: column.id,
        getValue: column.getSortValue,
        defaultDirection: column.defaultSortDirection,
      },
    ];
  });
}

export function useResourceTable<TData>({
  data,
  getRowId,
  columns = [],
  search,
  filters,
  sort,
  pagination,
}: {
  data: TData[];
  getRowId: (row: TData) => string;
  columns?: Array<ResourceTableColumn<TData>>;
  search?: {
    initialValue?: string;
    placeholder: string;
    ariaLabel: string;
    matches: (row: TData, normalizedQuery: string) => boolean;
    onChange?: (value: string) => void;
  };
  filters?: {
    initialValue?: ResourceFilterValue;
    groups: ResourceFilterGroup[];
    matches: (row: TData, filters: ResourceFilterValue) => boolean;
    onApply?: (filters: ResourceFilterValue) => void;
  };
  sort?: {
    initialColumn?: string;
    initialDirection?: ResourceSortDirection;
    columns?: Array<ResourceSortColumn<TData>>;
  };
  pagination: {
    initialPage?: number;
    pageSize: number;
    pageSizeOptions?: number[];
    onPageChange?: (page: number) => void;
  };
}) {
  const sortColumns = sort?.columns ?? getColumnSorts(columns);
  const [searchValue, setSearchValue] = useState(search?.initialValue ?? "");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterValue, setFilterValue] = useState<ResourceFilterValue>(
    filters?.initialValue ?? {},
  );
  const [draftFilterValue, setDraftFilterValue] = useState<ResourceFilterValue>(
    filters?.initialValue ?? {},
  );
  const initialSortColumn = sort?.initialColumn ?? sortColumns[0]?.id ?? null;
  const [sortColumn, setSortColumn] = useState<string | null>(
    initialSortColumn,
  );
  const [sortDirection, setSortDirection] = useState<ResourceSortDirection>(
    sort?.initialDirection ??
      sortColumns.find((column) => column.id === initialSortColumn)
        ?.defaultDirection ??
      "asc",
  );
  const [page, setPageState] = useState(
    Math.max(pagination.initialPage ?? 1, 1),
  );
  const [pageSize, setPageSizeState] = useState(
    Math.max(Math.floor(pagination.pageSize), 1),
  );
  const pageSizeOptions = Array.from(
    new Set([...(pagination.pageSizeOptions ?? [10, 15, 20, 50]), pageSize]),
  )
    .filter((option) => option > 0)
    .sort((left, right) => left - right);

  const normalizedQuery = searchValue.trim().toLowerCase();

  const filteredRows = useMemo(() => {
    return data.filter((row) => {
      const matchesSearch =
        !normalizedQuery || !search || search.matches(row, normalizedQuery);
      const matchesFilters = !filters || filters.matches(row, filterValue);
      return matchesSearch && matchesFilters;
    });
  }, [data, filterValue, filters, normalizedQuery, search]);

  const sortedRows = useMemo(() => {
    const column = sortColumns.find((item) => item.id === sortColumn);
    if (!column) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      const left = column.getValue(a);
      const right = column.getValue(b);
      const leftEmpty = left == null || left === "";
      const rightEmpty = right == null || right === "";
      if (leftEmpty && rightEmpty) return 0;
      if (leftEmpty) return 1;
      if (rightEmpty) return -1;

      let result: number;
      if (left instanceof Date || right instanceof Date) {
        result = new Date(left).getTime() - new Date(right).getTime();
      } else if (typeof left === "number" && typeof right === "number") {
        result = left - right;
      } else {
        result = String(left).localeCompare(String(right));
      }

      return sortDirection === "asc" ? result : -result;
    });
  }, [filteredRows, sortColumns, sortColumn, sortDirection]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(Math.max(page, 1), pageCount);
  const pageStart = (currentPage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, sortedRows.length);
  const pagedRows = sortedRows.slice(pageStart, pageEnd);

  const setPage = (nextPage: number) => {
    const clamped = Math.min(Math.max(nextPage, 1), pageCount);
    setPageState(clamped);
    pagination.onPageChange?.(clamped);
  };

  const setPageSize = (nextPageSize: number) => {
    const normalizedPageSize = Math.max(Math.floor(nextPageSize), 1);
    setPageSizeState(normalizedPageSize);
    setPageState(1);
    pagination.onPageChange?.(1);
  };

  const setSearch = (value: string) => {
    setSearchValue(value);
    setPageState(1);
    search?.onChange?.(value);
  };

  const setOpen = (open: boolean) => {
    setFilterOpen(open);
    if (open) setDraftFilterValue(filterValue);
  };

  const applyFilters = () => {
    setFilterValue(draftFilterValue);
    setPageState(1);
    setFilterOpen(false);
    filters?.onApply?.(draftFilterValue);
  };

  const cancelFilters = () => {
    setDraftFilterValue(filterValue);
    setFilterOpen(false);
  };

  const clearDraftFilters = () => {
    setDraftFilterValue({});
  };

  const clearFilters = () => {
    setFilterValue({});
    setDraftFilterValue({});
    setPageState(1);
    filters?.onApply?.({});
  };

  const toggleDraftOption = (
    groupId: string,
    optionValue: string,
    checked: boolean,
  ) => {
    setDraftFilterValue((current) => {
      const values = current[groupId] ?? [];
      const nextValues = checked
        ? [...values, optionValue].filter(
            (value, index, array) => array.indexOf(value) === index,
          )
        : values.filter((value) => value !== optionValue);
      return { ...current, [groupId]: nextValues };
    });
  };

  const toggleDraftGroup = (groupId: string) => {
    const group = filters?.groups.find((item) => item.id === groupId);
    if (!group) return;
    const allValues = group.options.map((option) => option.value);
    setDraftFilterValue((current) => {
      const currentValues = current[groupId] ?? [];
      return {
        ...current,
        [groupId]: sameStringSet(currentValues, allValues) ? [] : allValues,
      };
    });
  };

  const setSort = (
    columnId: string,
    defaultDirection?: ResourceSortDirection,
  ) => {
    if (sortColumn === columnId) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortColumn(columnId);
    setSortDirection(defaultDirection ?? "asc");
  };

  return {
    columns,
    dataCount: data.length,
    rows: sortedRows,
    pagedRows,
    totalCount: sortedRows.length,
    pageCount,
    page: currentPage,
    pageStart,
    pageEnd,
    getRowId,
    search: search
      ? {
          value: searchValue,
          placeholder: search.placeholder,
          ariaLabel: search.ariaLabel,
          setValue: setSearch,
        }
      : undefined,
    filters: filters
      ? {
          groups: filters.groups,
          open: filterOpen,
          setOpen,
          value: filterValue,
          draftValue: draftFilterValue,
          setDraftValue: setDraftFilterValue,
          activeCount: countActiveFilters(filterValue),
          draftActiveCount: countActiveFilters(draftFilterValue),
          apply: applyFilters,
          cancel: cancelFilters,
          clear: clearFilters,
          clearDraft: clearDraftFilters,
          toggleDraftOption,
          toggleDraftGroup,
        }
      : undefined,
    sort: sortColumns.length
      ? {
          column: sortColumn,
          direction: sortDirection,
          columns: sortColumns,
          setSort,
        }
      : undefined,
    pagination: {
      page: currentPage,
      pageSize,
      pageSizeOptions,
      setPage,
      setPageSize,
    },
  };
}
