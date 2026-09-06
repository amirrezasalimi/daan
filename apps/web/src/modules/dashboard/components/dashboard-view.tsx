import { Badge, Group, Text, Title } from "@mantine/core";

import { WorkspaceFrame, WorkspaceSidebar } from "@/shared/components";

import { useBooksQuery } from "../hooks/use-books";
import { BookList } from "./book-list";
import { DashboardInspector } from "./dashboard-inspector";
import { ImportDropzone } from "./import-dropzone";

export function DashboardView() {
  const { data: books, isLoading } = useBooksQuery();
  const count = books?.length ?? 0;

  return (
    <WorkspaceFrame
      breadcrumb="Library"
      sidebar={<WorkspaceSidebar activeItem="notes" />}
      inspector={<DashboardInspector />}
    >
      <div className="min-h-full bg-[var(--app-canvas)] p-5 sm:p-8 xl:p-11">
        <div className="mx-auto max-w-4xl">
          <Title order={1} className="!text-[clamp(2.25rem,4vw,4rem)]">
            My library
          </Title>

          <div className="mt-7">
            <ImportDropzone />
          </div>

          <section className="mt-10" aria-labelledby="books-title">
            <Group justify="space-between" align="center">
              <Title order={2} id="books-title" className="!text-[1.75rem]">
                Books
              </Title>
              <Badge variant="outline" color="brand">
                {count}
              </Badge>
            </Group>

            <div className="mt-5">
              {isLoading ? (
                <Text size="sm" c="var(--app-text-subtle)" ta="center" py="xl">
                  Loading…
                </Text>
              ) : (
                <BookList books={books ?? []} />
              )}
            </div>
          </section>
        </div>
      </div>
    </WorkspaceFrame>
  );
}
