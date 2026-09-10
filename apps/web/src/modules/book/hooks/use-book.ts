import type { AppRouter } from "@daan/api/routers/index";
import type { InferRouterOutputs } from "@orpc/server";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { client, orpc } from "@/shared/utils/orpc";

type RouterOutputs = InferRouterOutputs<AppRouter>;
export type BookChapter = RouterOutputs["book"]["getChapters"][number];
export type BookContent = RouterOutputs["book"]["getChapterContent"][number];
export type ChapterSearchResult = RouterOutputs["book"]["searchChapters"][number];

export function useBookQuery(id: string) {
  return useQuery(orpc.book.getById.queryOptions({ input: { id } }));
}

export function useChaptersQuery(bookId: string) {
  return useQuery(orpc.book.getChapters.queryOptions({ input: { bookId } }));
}

export function useUpdateReaderSettings(bookId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fontSize: number) => client.book.updateReaderSettings({ id: bookId, fontSize }),
    onSuccess: (settings) => {
      queryClient.setQueryData(
        orpc.book.getById.queryKey({ input: { id: bookId } }),
        (current: RouterOutputs["book"]["getById"] | undefined) =>
          current ? { ...current, settings } : undefined,
      );
    },
  });
}

export function useChapterContentQuery(chapterId: string | null) {
  return useQuery({
    ...orpc.book.getChapterContent.queryOptions({
      input: { chapterId: chapterId ?? "" },
    }),
    enabled: Boolean(chapterId),
  });
}

export function useChapterSearchQuery(bookId: string, query: string) {
  return useQuery({
    ...orpc.book.searchChapters.queryOptions({
      input: { bookId, query },
    }),
    enabled: query.length > 0,
    staleTime: 30_000,
  });
}
