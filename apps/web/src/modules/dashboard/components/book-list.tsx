import { ActionIcon, Badge, Button, Group, Modal, Text } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, BookOpen, FileText, Trash2 } from "lucide-react";
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
      <Text size="sm" c="var(--app-text-subtle)" ta="center" py="xl">
        No books yet. Drop a PDF or EPUB above to get started.
      </Text>
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
          This will permanently delete “{bookToDelete?.title}” and all of its
          chapters and extracted content. This action cannot be undone.
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

      <div className="grid gap-4">
        {books.map((book, index) => (
          <div
            key={book.id}
            className="group relative grid gap-5 rounded-3xl border border-[var(--app-border-subtle)] bg-[var(--app-surface-raised)] p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-[var(--app-border)] hover:shadow-sm sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-6"
          >
            <Link
              to="/book/$id"
              params={{ id: book.id }}
              className="absolute inset-0 rounded-3xl"
              aria-label={`Open ${book.title}`}
            />
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--app-border-subtle)] ${
                index === 0
                  ? "bg-[var(--app-surface-muted)] text-[var(--app-accent)]"
                  : "bg-[var(--app-surface)] text-[var(--app-text-muted)]"
              }`}
            >
              {book.type === "pdf" ? (
                <FileText size={22} strokeWidth={1.4} aria-hidden="true" />
              ) : (
                <BookOpen size={22} strokeWidth={1.4} aria-hidden="true" />
              )}
            </div>

            <div className="min-w-0">
              <Text ff="heading" fz="xl" c="var(--app-text)" className="truncate">
                {book.title}
              </Text>
              <Text size="sm" c="var(--app-text-muted)" mt={3} className="truncate">
                {book.author || book.description || "No description"}
              </Text>
            </div>

            <div className="relative z-10 hidden items-center gap-3 sm:flex">
              <Badge variant="light" color="brand" radius="sm">
                {typeLabel(book.type)}
              </Badge>
              <ActionIcon
                variant="subtle"
                aria-label={`Delete ${book.title}`}
                onClick={() => setBookToDelete(book)}
                className="text-[var(--app-danger)]"
              >
                <Trash2 size={16} strokeWidth={1.6} />
              </ActionIcon>
              <ArrowUpRight
                size={18}
                className="text-[var(--app-text-subtle)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--app-accent)]"
                aria-hidden="true"
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
