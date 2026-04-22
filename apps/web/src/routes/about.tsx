import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/about")({
  component: AboutPage,
})

function AboutPage() {
  return (
    <div className="flex max-w-md min-w-0 flex-col gap-2 text-sm leading-loose"></div>
  )
}
