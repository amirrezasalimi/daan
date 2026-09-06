import { createFileRoute } from "@tanstack/react-router";

import { BookView } from "@/modules/book";

export const Route = createFileRoute("/book/$id")({
  component: BookRoute,
});

function BookRoute() {
  const { id } = Route.useParams();

  return <BookView bookId={id} />;
}
