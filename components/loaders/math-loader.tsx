"use client"

import { useCallback, useState } from "react"
import { CheckCircle2, RotateCcw } from "lucide-react"

const RANGE = 5
const SIZE = 320
const PAD = 28
const PLOT = SIZE - PAD * 2
const STEP = PLOT / (RANGE * 2)
const INITIAL_POINT = { x: 2, y: 3 }
const LINES = Array.from({ length: RANGE * 2 + 1 }, (_, i) => i - RANGE)

// random integer point in range (excluding origin to keep it interesting)
function makePoint() {
  const rnd = () => Math.floor(Math.random() * (RANGE * 2 + 1)) - RANGE
  let x = rnd()
  let y = rnd()
  while (x === 0 && y === 0) {
    x = rnd()
    y = rnd()
  }
  return { x, y }
}

// convert grid coords -> svg pixels
function toSvg(x: number, y: number) {
  return { cx: PAD + (x + RANGE) * STEP, cy: PAD + (RANGE - y) * STEP }
}

function quadrantLabel(x: number, y: number) {
  if (x === 0 || y === 0) return "on an axis"
  if (x > 0 && y > 0) return "Quadrant I"
  if (x < 0 && y > 0) return "Quadrant II"
  if (x < 0 && y < 0) return "Quadrant III"
  return "Quadrant IV"
}

export function MathLoader() {
  const [target, setTarget] = useState(INITIAL_POINT)
  const [guess, setGuess] = useState<{ x: number; y: number } | null>(null)
  const [score, setScore] = useState(0)
  const [status, setStatus] = useState<"idle" | "correct" | "wrong">("idle")

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (status === "correct") return
      const svg = e.currentTarget
      const rect = svg.getBoundingClientRect()
      const px = ((e.clientX - rect.left) / rect.width) * SIZE
      const py = ((e.clientY - rect.top) / rect.height) * SIZE
      const gx = Math.round((px - PAD) / STEP - RANGE)
      const gy = Math.round(RANGE - (py - PAD) / STEP)
      const cx = Math.max(-RANGE, Math.min(RANGE, gx))
      const cy = Math.max(-RANGE, Math.min(RANGE, gy))
      setGuess({ x: cx, y: cy })
      if (cx === target.x && cy === target.y) {
        setStatus("correct")
        setScore((s) => s + 1)
      } else {
        setStatus("wrong")
      }
    },
    [status, target],
  )

  const next = useCallback(() => {
    setTarget(makePoint())
    setGuess(null)
    setStatus("idle")
  }, [])

  const guessPx = guess ? toSvg(guess.x, guess.y) : null
  const targetPx = toSvg(target.x, target.y)

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground">While the video loads, plot this point:</p>
        <p className="font-mono text-3xl font-bold text-math">
          ({target.x}, {target.y})
        </p>
      </div>

      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className={`w-full max-w-[320px] cursor-crosshair touch-none rounded-xl border bg-card transition-shadow duration-300 ${
          status === "correct"
            ? "border-green-500 shadow-[0_0_0_3px_rgba(34,197,94,0.22),0_0_28px_rgba(34,197,94,0.45)]"
            : "border-border"
        }`}
        onClick={handleClick}
        role="img"
        aria-label={`Coordinate grid. Plot the point ${target.x}, ${target.y}.`}
      >
        {LINES.map((n) => {
          const p = PAD + (n + RANGE) * STEP
          return (
            <g key={n}>
              <line x1={p} y1={PAD} x2={p} y2={SIZE - PAD} stroke="currentColor" className="text-border" strokeWidth={1} />
              <line x1={PAD} y1={p} x2={SIZE - PAD} y2={p} stroke="currentColor" className="text-border" strokeWidth={1} />
            </g>
          )
        })}
        {/* axes */}
        <line x1={PAD} y1={SIZE / 2} x2={SIZE - PAD} y2={SIZE / 2} stroke="currentColor" className="text-foreground" strokeWidth={2} />
        <line x1={SIZE / 2} y1={PAD} x2={SIZE / 2} y2={SIZE - PAD} stroke="currentColor" className="text-foreground" strokeWidth={2} />
        {/* axis arrow labels */}
        <text x={SIZE - PAD + 2} y={SIZE / 2 + 4} className="fill-muted-foreground text-[10px]">x</text>
        <text x={SIZE / 2 + 6} y={PAD - 6} className="fill-muted-foreground text-[10px]">y</text>

        {/* ghost target after answering */}
        {status !== "idle" && (
          <circle cx={targetPx.cx} cy={targetPx.cy} r={9} className="fill-none stroke-math" strokeWidth={2} strokeDasharray="3 3" />
        )}

        {/* user guess */}
        {guessPx && (
          <circle
            cx={guessPx.cx}
            cy={guessPx.cy}
            r={7}
            className={status === "correct" ? "fill-math" : "fill-destructive"}
          />
        )}
      </svg>

      <div className="flex min-h-[2.5rem] items-center gap-3 text-sm">
        {status === "idle" && (
          <span className="text-muted-foreground">Tap the grid where {target.x}, {target.y} belongs.</span>
        )}
        {status === "wrong" && guess && (
          <span className="max-w-[320px] text-center font-medium text-destructive">
            ({guess.x}, {guess.y}) is {quadrantLabel(guess.x, guess.y)}. Hint: move on the x-axis first, then go up
            or down.
          </span>
        )}
        {status === "correct" && (
          <span className="flex max-w-[320px] items-center gap-2 text-center font-semibold text-math">
            <CheckCircle2 className="size-4 shrink-0" /> Nice. You used x first, then y: {quadrantLabel(target.x, target.y)}.
          </span>
        )}
        {status === "correct" && (
          <button
            onClick={next}
            className="flex items-center gap-1 rounded-md bg-math px-3 py-1.5 text-xs font-semibold text-math-foreground hover:opacity-90"
          >
            <RotateCcw className="size-3.5" /> Next point
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Solved: {score}</p>
    </div>
  )
}
