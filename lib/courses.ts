export type CourseId = "math" | "chemistry" | "cs"

export type Course = {
  id: CourseId
  name: string
  subject: string
  lessonTitle: string
  description: string
  warmupTakeaway: string
  instructor: string
  duration: string
  accent: "math" | "chem" | "cs"
  videos: { id: string; title: string }[]
}

export const COURSES: Course[] = [
  {
    id: "math",
    name: "Coordinate Geometry",
    subject: "Mathematics",
    lessonTitle: "Lesson 4 — Plotting Points & The Cartesian Plane",
    description:
      "Learn how every point in the plane gets an address. We cover quadrants, axes, and how to read an ordered pair (x, y).",
    warmupTakeaway:
      "You just practiced reading an ordered pair, the exact skill this lesson uses to graph points on the Cartesian plane.",
    instructor: "Ms. XYZ",
    duration: "12:48",
    accent: "math",
    videos: [
      { id: "fNk_zzaMoSs", title: "Vectors — Essence of Linear Algebra" },
    ],
  },
  {
    id: "chemistry",
    name: "Atomic Bonding",
    subject: "Chemistry",
    lessonTitle: "Lesson 2 — Why Atoms Stick Together",
    description:
      "Atoms are social — they share and trade electrons to feel stable. Discover covalent and ionic bonds by building real molecules.",
    warmupTakeaway:
      "You just matched atoms to a chemical formula, which is the same counting skill used to understand molecular bonding.",
    instructor: "Dr. ABC",
    duration: "10:21",
    accent: "chem",
    videos: [
      { id: "FSyAehMdpyI", title: "Crash Course Chemistry — Introduction" },
    ],
  },
  {
    id: "cs",
    name: "Intro to Algorithms",
    subject: "Computer Science",
    lessonTitle: "Lesson 6 — Sorting & How Computers Order Data",
    description:
      "Watch how an algorithm thinks. We visualize Bubble Sort step by step, then talk about why some algorithms are faster than others.",
    warmupTakeaway:
      "You just watched comparison-based sorting: Bubble Sort repeatedly compares neighbors and swaps them when they are out of order.",
    instructor: "Mr. ABC",
    duration: "14:05",
    accent: "cs",
    videos: [
      { id: "kPRA0W1kECg", title: "15 Sorting Algorithms in 6 Minutes" },
    ],
  },
]

export function getCourse(id: CourseId): Course {
  return COURSES.find((c) => c.id === id) ?? COURSES[0]
}
