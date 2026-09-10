import { ActionIcon, Badge, Button, Group, Modal, Text } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { BookOpen, FileText, Library, Trash2 } from "lucide-react";
import { useState } from "react";

import { type BookSummary, useDeleteBook } from "../hooks/use-books";

interface BookListProps {
  books: BookSummary[];
}

function typeLabel(type: BookSummary["type"]) {
  return type === "pdf" ? "PDF" : "EPUB";
}

export function BookList({ books }: BookListProps) {
  const deleteBook = useDeleteBook();
  const [bookToDelete, setBookToDelete] = useState<BookSummary | null>(null);

  const confirmDelete = () => {
    if (!bookToDelete) return;
    deleteBook.mutate(bookToDelete.id, {
      onSuccess: () => setBookToDelete(null),
    });
  };

  if (books.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-3xl border border-[var(--app-border-subtle)] bg-[var(--app-surface)] px-6 py-14 text-center sm:py-16">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]">
          <Library size={20} strokeWidth={1.5} aria-hidden="true" />
        </span>
        <Text ff="heading" fz="xl" c="var(--app-text)" mt="md">
          Your shelves are ready
        </Text>
        <Text size="sm" c="var(--app-text-muted)" mt={6} maw={380} lh={1.6}>
          Import your first PDF or EPUB above. It will appear here when it is ready to read.
        </Text>
      </div>
    );
  }

  return (
    <>
      <Modal
        opened={bookToDelete != null}
        onClose={() => setBookToDelete(null)}
        title="Delete book?"
        size="sm"
        radius="lg"
        centered
        closeOnClickOutside={!deleteBook.isPending}
        closeOnEscape={!deleteBook.isPending}
        withCloseButton={!deleteBook.isPending}
        overlayProps={{ backgroundOpacity: 0.4, blur: 2 }}
      >
        <Text size="sm" c="var(--app-text-muted)">
          This will permanently delete “{bookToDelete?.title}” and all of its chapters and extracted
          content. This action cannot be undone.
        </Text>
        <Group justify="flex-end" mt="xl">
          <Button
            variant="default"
            disabled={deleteBook.isPending}
            onClick={() => setBookToDelete(null)}
          >
            Cancel
          </Button>
          <Button
            loading={deleteBook.isPending}
            onClick={confirmDelete}
            className="!bg-[var(--app-danger)]"
          >
            Delete book
          </Button>
        </Group>
      </Modal>

      <div className="overflow-hidden rounded-3xl border border-[var(--app-border-subtle)] bg-[var(--app-surface-raised)]">
        {books.map((book) => (
          <article
            key={book.id}
            className="group relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-b border-[var(--app-border-subtle)] p-4 transition-colors last:border-b-0 hover:bg-[var(--app-surface)] sm:gap-5 sm:p-5"
          >
            <Link
              to="/book/$id"
              params={{ id: book.id }}
              className="absolute inset-0"
              aria-label={`Open ${book.title}`}
            />
            <div className="flex h-12 w-10 items-center justify-center rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-surface-muted)] text-[var(--app-accent)] sm:h-14 sm:w-12">
              {book.type === "pdf" ? (
                <FileText size={20} strokeWidth={1.4} aria-hidden="true" />
              ) : (
                <BookOpen size={20} strokeWidth={1.4} aria-hidden="true" />
              )}
            </div>

            <div className="min-w-0">
              <Text ff="heading" fz="lg" c="var(--app-text)" className="truncate sm:!text-xl">
                {book.title}
              </Text>
              <Text size="sm" c="var(--app-text-muted)" mt={2} className="truncate">
                {book.author || book.description || "Author unknown"}
              </Text>
            </div>

            <div className="relative z-10 flex items-center gap-1 sm:gap-3">
              <Badge variant="light" color="brand" radius="xl" className="hidden sm:block">
                {typeLabel(book.type)}
              </Badge>
              <ActionIcon
                variant="subtle"
                aria-label={`Delete ${book.title}`}
                onClick={() => setBookToDelete(book)}
                className="text-[var(--app-text-subtle)] hover:!bg-[var(--app-surface-muted)] hover:!text-[var(--app-danger)]"
              >
                <Trash2 size={16} strokeWidth={1.6} />
              </ActionIcon>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
