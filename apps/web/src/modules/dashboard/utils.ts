export type BookSourceType = "pdf" | "ebook";

export interface AcceptedFile {
  file: File;
  type: BookSourceType;
}

const EXTENSION_TYPES: Record<string, BookSourceType> = {
  pdf: "pdf",
  epub: "ebook",
};

/** Map a file to a supported book source type, or null when unsupported. */
export function classifyFile(file: File): BookSourceType | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TYPES[ext] ?? null;
}

/** Read a File into a base64 string (without the data-URL prefix). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unexpected file contents"));
        return;
      }
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64 ?? "");
    };
    reader.readAsDataURL(file);
  });
}
