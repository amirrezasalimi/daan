import type { AppRouter } from "@daan/api/routers/index";
import type { InferRouterOutputs } from "@orpc/server";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { client, orpc } from "@/shared/utils/orpc";

type RouterOutputs = InferRouterOutputs<AppRouter>;
export type BookSummary = RouterOutputs["book"]["list"][number];

export interface ImportBookInput {
  fileName: string;
  type: "pdf" | "ebook";
  data: string;
  title?: string;
  author?: string;
}

export function useBooksQuery() {
  return useQuery(orpc.book.list.queryOptions());
}

export function useImportBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ImportBookInput) => client.book.import(input),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: orpc.book.list.queryKey() });
      toast.success(`Imported “${result.title}” · ${result.chapterCount} chapter(s)`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to import book");
    },
  });
}

export function useDeleteBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => client.book.delete({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orpc.book.list.queryKey() });
      toast.success("Book removed");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove book");
    },
  });
}
