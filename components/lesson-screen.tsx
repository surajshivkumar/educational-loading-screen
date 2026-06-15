"use client"

import { useEffect, useState } from "react"
import type { CSSProperties } from "react"
import Link from "next/link"
import { ArrowLeft, Play, CheckCircle2 } from "lucide-react"
import type { Course } from "@/lib/courses"
import { MathLoader } from "@/components/loaders/math-loader"
import { ChemistryLoader } from "@/components/loaders/chemistry-loader"
import { CSLoader } from "@/components/loaders/cs-loader"
import { LOAD_SECONDS } from "@/lib/constants"


export function LessonScreen({ course }: { course: Course }) {
  const [ready, setReady] = useState(false)
  const [started, setStarted] = useState(false)
  
  const video = course.videos[0]

  useEffect(() => {
    const id = setTimeout(() => setReady(true), LOAD_SECONDS * 1000)
    return () => clearTimeout(id)
  }, [])

  const accent = course.accent

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: `var(--${accent})` }}
          >
            {course.subject}
          </p>
          <h1 className="truncate text-lg font-bold text-foreground sm:text-xl">{course.lessonTitle}</h1>
        </div>
        <Link
          href="/"
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-4" /> Courses
        </Link>
      </div>

      <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {started ? (
          <div className="relative aspect-video w-full shrink-0 bg-foreground">
            <iframe
              className="h-full w-full"
              src={`https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0`}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : ready ? (
          <div
            className="flex shrink-0 flex-col gap-3 px-5 py-4 text-primary-foreground sm:flex-row sm:items-center sm:justify-between"
            style={{ backgroundColor: `var(--${accent})` }}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">Your video is ready — finish the warm-up or jump in now.</p>
                <p className="mt-0.5 text-xs text-primary-foreground/80">{course.warmupTakeaway}</p>
              </div>
            </div>
            <button
              onClick={() => setStarted(true)}
              className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-card px-4 py-2 text-sm font-bold text-card-foreground transition-transform hover:scale-[1.02]"
            >
              <Play className="size-4 fill-current" /> Go to lesson
            </button>
          </div>
        ) : (
          <div className="shrink-0 bg-foreground px-5 py-3 text-primary-foreground">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 animate-pulse rounded-full"
                  style={{ backgroundColor: `var(--${accent})` }}
                  aria-hidden="true"
                />
                <p className="text-sm font-medium text-primary-foreground/80">Preparing your lesson video…</p>
              </div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary-foreground/65">Loading</p>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-primary-foreground/15" aria-hidden="true">
              <div
                className="lesson-loader-fill h-full rounded-full"
                style={{ "--loader-color": `var(--${accent})` } as CSSProperties}
              />
            </div>
          </div>
        )}

        <div className="px-5 py-6">
          {started ? (
            <div className="flex flex-col gap-2">
              <h2 className="text-base font-bold text-card-foreground">{course.name}</h2>
              <p className="text-sm text-muted-foreground">{course.description}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Instructor: {course.instructor}</span>
                <span>Runtime: {course.duration}</span>
                <span className="truncate">Now playing: {video.title}</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <span className="mb-1 text-center text-xs text-muted-foreground">
                {ready
                  ? "Nice. This warm-up connects directly to the lesson waiting for you."
                  : "Try one quick warm-up while the lesson video loads:"}
              </span>
              <span
                className="mb-4 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                style={{ backgroundColor: `var(--${accent})`, color: `var(--${accent}-foreground)` }}
              >
                {course.subject} warm-up
              </span>
              {course.id === "math" && <MathLoader />}
              {course.id === "chemistry" && <ChemistryLoader />}
              {course.id === "cs" && <CSLoader />}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
