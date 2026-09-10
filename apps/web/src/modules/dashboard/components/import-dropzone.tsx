import { Text } from "@mantine/core";
import { FileUp, Loader2 } from "lucide-react";
import { type DragEvent, useRef, useState } from "react";
import { toast } from "sonner";

import { useImportBook } from "../hooks/use-books";
import { classifyFile, fileToBase64 } from "../utils";

export function ImportDropzone() {
  const importBook = useImportBook();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const type = classifyFile(file);
      if (!type) {
        toast.error(`Unsupported file: ${file.name}`);
        continue;
      }

      try {
        const data = await fileToBase64(file);
        importBook.mutate({ fileName: file.name, type, data });
      } catch {
        toast.error(`Could not read ${file.name}`);
      }
    }
  };

  const onDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void handleFiles(event.dataTransfer.files);
  };

  const busy = importBook.isPending;

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        if (!busy) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      aria-label="Import PDF or EPUB files"
      className={`group flex w-full flex-col items-center justify-center rounded-3xl border border-dashed px-6 py-10 text-center transition-[border-color,background-color,transform] sm:py-12 ${
        isDragging
          ? "scale-[1.01] border-[var(--app-accent)] bg-[var(--app-surface-muted)]"
          : "border-[var(--app-border)] bg-[var(--app-surface-raised)] hover:border-[var(--app-accent)] hover:bg-[var(--app-surface)]"
      } disabled:cursor-wait disabled:opacity-70`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.epub"
        multiple
        hidden
        onChange={(event) => {
          void handleFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--app-border-subtle)] bg-[var(--app-surface-muted)] text-[var(--app-accent)] transition-transform group-hover:-translate-y-0.5">
        {busy ? (
          <Loader2 size={22} strokeWidth={1.6} className="animate-spin" aria-hidden="true" />
        ) : (
          <FileUp size={22} strokeWidth={1.5} aria-hidden="true" />
        )}
      </span>
      <Text ff="heading" fz="xl" c="var(--app-text)" mt="md">
        {busy
          ? "Preparing your book…"
          : isDragging
            ? "Release to import"
            : "Bring a book into Daan"}
      </Text>
      <Text size="sm" c="var(--app-text-muted)" mt={6}>
        {busy
          ? "Extracting its structure and chapters"
          : "Drop files here or click to browse · PDF and EPUB"}
      </Text>
    </button>
  );
}
