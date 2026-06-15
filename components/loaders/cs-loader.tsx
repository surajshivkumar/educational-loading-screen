"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Pause, Play, RotateCcw, SkipForward } from "lucide-react"

const COUNT = 8
const MAX = 100
const INITIAL_ARRAY = [42, 18, 76, 31, 64, 25, 90, 53]

function randomArray() {
  return Array.from({ length: COUNT }, () => Math.floor(Math.random() * (MAX - 12)) + 12)
}

type Frame = {
  arr: number[]
  a: number
  b: number
  sortedFrom: number
  swapped: boolean
  pass: number
}

function buildFrames(input: number[]): Frame[] {
  const arr = [...input]
  const frames: Frame[] = []
  let sortedFrom = arr.length
  for (let pass = 0; pass < arr.length - 1; pass++) {
    let didSwap = false
    for (let i = 0; i < sortedFrom - 1; i++) {
      const willSwap = arr[i] > arr[i + 1]
      frames.push({ arr: [...arr], a: i, b: i + 1, sortedFrom, swapped: willSwap, pass: pass + 1 })
      if (willSwap) {
        ;[arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]
        didSwap = true
      }
    }
    sortedFrom--
    if (!didSwap) break
  }
  frames.push({ arr: [...arr], a: -1, b: -1, sortedFrom: 0, swapped: false, pass: 0 })
  return frames
}

export function CSLoader() {
  const [values, setValues] = useState(INITIAL_ARRAY)
  const frames = useMemo(() => buildFrames(values), [values])
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(true)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const frame = frames[Math.min(step, frames.length - 1)]
  const finished = step >= frames.length - 1

  useEffect(() => {
    if (playing && !finished) {
      timer.current = setInterval(() => setStep((s) => Math.min(s + 1, frames.length - 1)), 650)
    }
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [playing, finished, frames.length])

  const restart = useCallback(() => {
    setValues(randomArray())
    setStep(0)
    setPlaying(true)
  }, [])

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground">While the video loads, watch a computer think:</p>
        <p className="text-2xl font-bold text-cs">Bubble Sort</p>
      </div>

      {/* Bars */}
      <div
        className={`flex h-44 w-full max-w-[340px] items-stretch justify-center gap-1.5 rounded-xl border bg-card p-3 transition-shadow duration-300 ${
          finished
            ? "border-green-500 shadow-[0_0_0_3px_rgba(34,197,94,0.22),0_0_28px_rgba(34,197,94,0.45)]"
            : "border-border"
        }`}
      >
        {frame.arr.map((v, i) => {
          const isComparing = i === frame.a || i === frame.b
          const isSorted = i >= frame.sortedFrom
          let color = "var(--muted-foreground)"
          if (isSorted) color = "var(--chem)"
          if (isComparing) color = frame.swapped ? "var(--destructive)" : "var(--cs)"
          return (
            <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <div
                className="w-full rounded-t-sm transition-all duration-300"
                style={{ height: `${v}%`, backgroundColor: color }}
              />
              <span className="font-mono text-[9px] text-muted-foreground">{v}</span>
            </div>
          )
        })}
      </div>
      <p className="min-h-[1.25rem] text-center text-xs text-muted-foreground">
        {finished ? (
          <span className="font-semibold text-chem">
            Sorted. Bubble Sort compares neighbors until every value is locked in.
          </span>
        ) : frame.swapped ? (
          <>
            Comparing <span className="font-semibold text-destructive">{frame.arr[frame.a]} &gt; {frame.arr[frame.b]}</span> — swap
            because the left number is larger.
          </>
        ) : (
          <>
            Comparing <span className="font-semibold text-cs">{frame.arr[frame.a]} ≤ {frame.arr[frame.b]}</span> — no swap
            because these neighbors are already ordered.
          </>
        )}
      </p>
      <div className="flex items-center gap-2">
        {!finished ? (
          <>
            <button
              onClick={() => setPlaying((p) => !p)}
              className="flex items-center gap-1.5 rounded-md bg-cs px-3 py-1.5 text-xs font-semibold text-cs-foreground hover:opacity-90"
            >
              {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              {playing ? "Pause" : "Play"}
            </button>
            <button
              onClick={() => {
                setPlaying(false)
                setStep((s) => Math.min(s + 1, frames.length - 1))
              }}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
            >
              <SkipForward className="size-3.5" /> Step
            </button>
          </>
        ) : (
          <button
            onClick={restart}
            className="flex items-center gap-1.5 rounded-md bg-cs px-3 py-1.5 text-xs font-semibold text-cs-foreground hover:opacity-90"
          >
            <RotateCcw className="size-3.5" /> Shuffle &amp; sort again
          </button>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-3 text-[10px] text-muted-foreground">
        <Legend color="var(--cs)" label="comparing" />
        <Legend color="var(--destructive)" label="swapping" />
        <Legend color="var(--chem)" label="locked in" />
      </div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="size-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}
