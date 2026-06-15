import { notFound } from "next/navigation"
import { COURSES } from "@/lib/courses"
import { SiteHeader } from "@/components/site-header"
import { LessonScreen } from "@/components/lesson-screen"

export function generateStaticParams() {
  return COURSES.map((c) => ({ id: c.id }))
}

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }  = await params
  const course = COURSES.find((c) => c.id === id)
  if (!course) notFound()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <LessonScreen key={course.id} course={course} />
    </div>
  )
}
