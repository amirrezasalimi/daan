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
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      aria-label="Import a book"
      className={`group flex w-full items-center justify-center gap-3 rounded-2xl border border-dashed px-5 py-6 text-left transition-colors ${
        isDragging
          ? "border-[var(--app-accent)] bg-[var(--app-surface-muted)]"
          : "border-[var(--app-border)] bg-[var(--app-surface-raised)] hover:border-[var(--app-accent)]"
      }`}
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
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--app-surface-muted)] text-[var(--app-accent)]">
        {busy ? (
          <Loader2 size={19} strokeWidth={1.6} className="animate-spin" aria-hidden="true" />
        ) : (
          <FileUp size={19} strokeWidth={1.5} aria-hidden="true" />
        )}
      </span>
      <div>
        <Text fw={600} c="var(--app-text)">
          {busy ? "Importing…" : "Drop a PDF or EPUB"}
        </Text>
        <Text size="xs" c="var(--app-text-muted)" mt={2}>
          {busy ? "Detecting chapters…" : "Click to browse · PDF or EPUB"}
        </Text>
      </div>
    </button>
  );
}
