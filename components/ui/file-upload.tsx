"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { Upload } from "lucide-react";

import { Label } from "@/components/ui/label";
import { useFileDrop } from "@/components/ui/use-file-drop";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  label: string;
  name: string;
  className?: string;
  labelClassName?: string;
  dropzoneClassName?: string;
  accept?: string;
  multiple?: boolean;
  required?: boolean;
  placeholder?: string;
  onFileSelect?: (file: File | null) => void;
  onFilesSelect?: (files: File[]) => void;
  disabled?: boolean;
}

export interface FileUploadRef {
  clear: () => void;
}

export const FileUpload = forwardRef<FileUploadRef, FileUploadProps>(
  (
    {
      label,
      name,
      className,
      labelClassName,
      dropzoneClassName,
      accept,
      multiple,
      required,
      onFileSelect,
      onFilesSelect,
      placeholder,
      disabled = false,
    },
    ref,
  ) => {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const id = name;

    useImperativeHandle(ref, () => ({
      clear: () => {
        if (inputRef.current) inputRef.current.value = "";
        setFileName(null);
      },
    }));

    function selectFiles(files: File[]) {
      const file = files[0] ?? null;
      setFileName(
        files.length > 1
          ? `${files.length} files selected`
          : (file?.name ?? null),
      );
      onFileSelect?.(file);
      onFilesSelect?.(files);
    }

    function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
      selectFiles(Array.from(e.target.files ?? []));
    }

    const { isDragging, dropProps } = useFileDrop({
      accept,
      multiple,
      disabled,
      onFiles: selectFiles,
    });

    function handleClick() {
      if (disabled) return;
      if (inputRef.current) inputRef.current.value = "";
      inputRef.current?.click();
    }

    return (
      <div className={cn("grid gap-1", className)}>
        <Label
          htmlFor={id}
          className={cn(
            "text-muted-foreground text-xs font-normal",
            labelClassName,
          )}
        >
          {label}
          {required && <span className="text-red-500"> *</span>}
        </Label>

        <button
          type="button"
          onClick={handleClick}
          {...dropProps}
          disabled={disabled}
          className={cn(
            "flex w-full items-center gap-2 rounded-[0.33em] border border-gray-300 px-4 py-4 text-left text-sm transition-colors",
            "hover:bg-muted text-muted-foreground hover:cursor-pointer",
            isDragging && "border-primary bg-primary/5 ring-2 ring-primary/15",
            disabled && "cursor-not-allowed opacity-60",
            dropzoneClassName,
          )}
          aria-label={label}
        >
          <Upload className="text-primary h-5 w-5 shrink-0" />
          {fileName ? (
            <span className="text-foreground min-w-0 truncate">{fileName}</span>
          ) : (
            <span className="min-w-0 truncate">
              {placeholder ?? "Drop a file here or click to upload"}
            </span>
          )}
        </button>

        <input
          ref={inputRef}
          id={id}
          type="file"
          name={name}
          accept={accept}
          multiple={multiple}
          required={required}
          onChange={handleFileChange}
          disabled={disabled}
          className="hidden"
        />
      </div>
    );
  },
);

FileUpload.displayName = "FileUpload";
