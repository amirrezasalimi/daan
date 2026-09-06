import type { AppRouter } from "@daan/api/routers/index";
import type { InferRouterOutputs } from "@orpc/server";
import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/shared/utils/orpc";

type RouterOutputs = InferRouterOutputs<AppRouter>;
export type BookChapter = RouterOutputs["book"]["getChapters"][number];
export type BookContent = RouterOutputs["book"]["getChapterContent"][number];
export type ChapterSearchResult =
  RouterOutputs["book"]["searchChapters"][number];

export function useBookQuery(id: string) {
  return useQuery(orpc.book.getById.queryOptions({ input: { id } }));
}

export function useChaptersQuery(bookId: string) {
  return useQuery(orpc.book.getChapters.queryOptions({ input: { bookId } }));
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
