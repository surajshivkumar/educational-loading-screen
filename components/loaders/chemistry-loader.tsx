"use client"

import { useCallback, useState } from "react"
import { CheckCircle2, RotateCcw, Sparkles } from "lucide-react"

type Element = "H" | "O" | "C" | "N"

const ELEMENTS: Record<Element, { name: string; color: string; r: number }> = {
  H: { name: "Hydrogen", color: "#e2e8f0", r: 16 },
  O: { name: "Oxygen", color: "#ef4444", r: 26 },
  C: { name: "Carbon", color: "#334155", r: 24 },
  N: { name: "Nitrogen", color: "#3b82f6", r: 24 },
}

type Molecule = {
  formula: string
  name: string
  need: Partial<Record<Element, number>>
  fact: string
  center: Element
  outer: Element[]
}

const MOLECULES: Molecule[] = [
  {
    formula: "H₂O",
    name: "Water",
    need: { H: 2, O: 1 },
    center: "O",
    outer: ["H", "H"],
    fact: "Oxygen shares electrons with two hydrogens — that's a covalent bond. Same trick keeps you hydrated!",
  },
  {
    formula: "CO₂",
    name: "Carbon Dioxide",
    need: { C: 1, O: 2 },
    center: "C",
    outer: ["O", "O"],
    fact: "Carbon double-bonds to two oxygens. You breathe this out about 20,000 times a day.",
  },
  {
    formula: "NH₃",
    name: "Ammonia",
    need: { N: 1, H: 3 },
    center: "N",
    outer: ["H", "H", "H"],
    fact: "Nitrogen happily shares with three hydrogens. It's the base of most cleaning sprays.",
  },
  {
    formula: "CH₄",
    name: "Methane",
    need: { C: 1, H: 4 },
    center: "C",
    outer: ["H", "H", "H", "H"],
    fact: "One carbon, four hydrogens — the simplest fuel and the main gas cows are famous for.",
  },
]

const PALETTE: Element[] = ["H", "O", "C", "N"]

function Atom({ el, size = 1 }: { el: Element; size?: number }) {
  const cfg = ELEMENTS[el]
  return (
    <span
      className="relative flex items-center justify-center rounded-full text-xs font-bold shadow-sm ring-2 ring-black/5"
      style={{
        width: cfg.r * 1.6 * size,
        height: cfg.r * 1.6 * size,
        backgroundColor: cfg.color,
        color: el === "H" || el === "O" ? "#0f172a" : "#f8fafc",
      }}
    >
      {el}
    </span>
  )
}

export function ChemistryLoader() {
  const [index, setIndex] = useState(0)
  const target = MOLECULES[index]
  const [counts, setCounts] = useState<Partial<Record<Element, number>>>({})
  const [done, setDone] = useState(false)

  const selected = Object.values(counts).reduce((sum, count) => sum + (count ?? 0), 0)
  const hasExtra = (Object.keys(counts) as Element[]).some((el) => (counts[el] ?? 0) > (target.need[el] ?? 0))

  const add = useCallback(
    (el: Element) => {
      if (done) return
      setCounts((prev) => {
        const nextVal = (prev[el] ?? 0) + 1
        const next = { ...prev, [el]: nextVal }
        const complete = (Object.keys(target.need) as Element[]).every(
          (k) => (next[k] ?? 0) === target.need[k],
        )
        const noExtras = (Object.keys(next) as Element[]).every(
          (k) => (next[k] ?? 0) <= (target.need[k] ?? 0),
        )
        if (complete && noExtras) setDone(true)
        return next
      })
    },
    [done, target],
  )

  const reset = useCallback(() => {
    setCounts({})
    setDone(false)
  }, [])

  const nextMolecule = useCallback(() => {
    setIndex((i) => (i + 1) % MOLECULES.length)
    setCounts({})
    setDone(false)
  }, [])

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground">Help these atoms get along — build:</p>
        <p className="text-2xl font-bold text-chem">
          {target.name} <span className="font-mono">({target.formula})</span>
        </p>
      </div>

      {/* Reaction chamber */}
      <div
        className={`flex min-h-[150px] w-full max-w-[320px] items-center justify-center rounded-xl border bg-card p-4 transition-shadow duration-300 ${
          done
            ? "border-green-500 shadow-[0_0_0_3px_rgba(34,197,94,0.22),0_0_28px_rgba(34,197,94,0.45)]"
            : "border-border"
        }`}
      >
        {!done ? (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {(Object.keys(target.need) as Element[]).flatMap((el) =>
              Array.from({ length: counts[el] ?? 0 }, (_, i) => <Atom key={`${el}-${i}`} el={el} />),
            )}
            {Object.keys(counts).length === 0 && (
              <span className="text-sm text-muted-foreground">Click atoms below to drop them in</span>
            )}
            {hasExtra && (
              <span className="basis-full text-center text-xs font-medium text-destructive">
                Hint: the formula tells you the exact atom count. Clear the chamber and match each number.
              </span>
            )}
          </div>
        ) : (
          <FormedMolecule molecule={target} />
        )}
      </div>
      {!done ? (
        <>
          <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
            {(Object.keys(target.need) as Element[]).map((el) => (
              <span key={el} className="rounded-full bg-muted px-2 py-1 font-medium">
                {counts[el] ?? 0}/{target.need[el]} {ELEMENTS[el].name}
              </span>
            ))}
          </div>
          {selected > 0 && !hasExtra && (
            <p className="max-w-[320px] text-center text-xs text-muted-foreground">
              Keep matching the formula counts. No extra atoms needed.
            </p>
          )}
          <div className="flex items-center gap-3">
            {PALETTE.map((el) => (
              <button
                key={el}
                onClick={() => add(el)}
                className="flex flex-col items-center gap-1 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-chem"
                aria-label={`Add ${ELEMENTS[el].name} atom`}
              >
                <Atom el={el} />
                <span className="text-[10px] text-muted-foreground">{el}</span>
              </button>
            ))}
            <button
              onClick={reset}
              className="ml-1 flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted"
              aria-label="Clear chamber"
            >
              <RotateCcw className="size-4" />
            </button>
          </div>
        </>
      ) : (
        <div className="flex max-w-[320px] flex-col items-center gap-3 text-center">
          <span className="flex items-center gap-2 font-semibold text-chem">
            <CheckCircle2 className="size-4" /> Bonded! You made {target.name}.
          </span>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent" />
            {target.fact}
          </p>
          <button
            onClick={nextMolecule}
            className="flex items-center gap-1 rounded-md bg-chem px-3 py-1.5 text-xs font-semibold text-chem-foreground hover:opacity-90"
          >
            <RotateCcw className="size-3.5" /> New molecule
          </button>
        </div>
      )}
    </div>
  )
}

function FormedMolecule({ molecule }: { molecule: Molecule }) {
  const n = molecule.outer.length
  const radius = 46
  return (
    <div className="relative flex size-32 items-center justify-center">
      {molecule.outer.map((el, i) => {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2
        const x = Math.cos(angle) * radius
        const y = Math.sin(angle) * radius
        return (
          <span
            key={i}
            className="absolute animate-in fade-in zoom-in"
            style={{ transform: `translate(${x}px, ${y}px)` }}
          >
            <Atom el={el} size={0.85} />
          </span>
        )
      })}
      <span className="relative z-10">
        <Atom el={molecule.center} />
      </span>
    </div>
  )
}
