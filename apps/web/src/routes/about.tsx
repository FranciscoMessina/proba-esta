import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/about")({
  component: AboutPage,
})

function AboutPage() {
  return (
    <div className="flex max-w-md min-w-0 flex-col gap-2 text-sm leading-loose">
      <h1 className="font-medium">About</h1>
      <p className="text-muted-foreground">
        This page uses TanStack Router with a shadcn sidebar layout.
      </p>
    </div>
  )
}
