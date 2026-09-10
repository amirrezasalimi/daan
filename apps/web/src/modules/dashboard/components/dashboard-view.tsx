import { Badge, Loader, Text, Title } from "@mantine/core";

import { WorkspaceFrame } from "@/shared/components";

import { useBooksQuery } from "../hooks/use-books";
import { BookList } from "./book-list";
import { ImportDropzone } from "./import-dropzone";

export function DashboardView() {
  const { data: books, isLoading } = useBooksQuery();
  const count = books?.length ?? 0;

  return (
    <WorkspaceFrame breadcrumb="Library" inspector={<ImportDropzone />}>
      <div className="min-h-full bg-[var(--app-canvas)] px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
        <section className="mx-auto max-w-5xl" aria-labelledby="books-title">
          <div className="flex items-center justify-between gap-4 border-b border-[var(--app-border)] pb-4">
            <Title order={1} id="books-title" className="!text-[clamp(2rem,4vw,3rem)]">
              My library
            </Title>
            {!isLoading && count > 0 ? (
              <Badge variant="light" color="brand" radius="xl">
                {count} {count === 1 ? "book" : "books"}
              </Badge>
            ) : null}
          </div>

          <div className="mt-6 lg:hidden">
            <ImportDropzone />
          </div>

          <div className="mt-6">
            {isLoading ? (
              <div className="flex items-center justify-center gap-3 rounded-3xl border border-[var(--app-border-subtle)] bg-[var(--app-surface)] py-16">
                <Loader size="sm" color="brand" />
                <Text size="sm" c="var(--app-text-muted)">
                  Loading books…
                </Text>
              </div>
            ) : (
              <BookList books={books ?? []} />
            )}
          </div>
        </section>
      </div>
    </WorkspaceFrame>
  );
}
