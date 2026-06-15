import Link from "next/link"
import { Calculator, FlaskConical, Code2, Play, Clock, type LucideIcon } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { COURSES, type CourseId } from "@/lib/courses"

const ICONS: Record<CourseId, LucideIcon> = {
  math: Calculator,
  chemistry: FlaskConical,
  cs: Code2,
}

export default function Page() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <section className="border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <span className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase tracking-wide text-accent-foreground">
            Digital Library · Video Lessons
          </span>
          <h1 className="mt-4 max-w-2xl text-balance text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl">
            Pick a lesson. Learn something new today.
          </h1>
        </div>
      </section>
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Your Courses</h2>
            <p className="text-sm text-muted-foreground">Choose a class to start today&apos;s lesson.</p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {COURSES.map((course) => {
            const Icon = ICONS[course.id]
            return (
              <article
                key={course.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-lg"
              >
                <div
                  className="flex items-center justify-between px-5 py-5"
                  style={{ backgroundColor: `var(--${course.accent})`, color: `var(--${course.accent}-foreground)` }}
                >
                  <Icon className="size-8" aria-hidden="true" />
                  <span className="flex items-center gap-1 text-xs font-medium opacity-90">
                    <Clock className="size-3.5" /> {course.duration}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {course.subject}
                  </p>
                  <h3 className="text-lg font-bold text-card-foreground">{course.name}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{course.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{course.lessonTitle}</p>
                  <Link
                    href={`/lesson/${course.id}`}
                    className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <Play className="size-4 fill-current" /> Open video lesson
                  </Link>
                </div>
              </article>
            )
          })}
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-muted-foreground">
          Demo note: each lesson simulates a 20-second video load to show the interactive loading experience.
          After the countdown, a real lesson video plays.
        </p>
      </main>
    </div>
  )
}
