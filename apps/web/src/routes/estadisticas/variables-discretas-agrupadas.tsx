import { createFileRoute } from "@tanstack/react-router"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { useMemo, useState, type ReactNode } from "react"
import { InlineMath } from "react-katex"

import {
  StatFormulaDialog,
  type StatFormulaDialogProps,
} from "@/components/stat-formula-dialog"
import { parseNumericToken } from "@/solvers/variables-discretas/discrete-descriptive-stats"
import { latexNum } from "@/solvers/variables-discretas/discrete-stat-formula-latex"
import {
  computeGroupedDiscreteFractile,
  computeGroupedDiscreteDescriptiveStatsFromFrequencyTable,
  type GroupedDiscreteDescriptiveStats,
} from "@/solvers/variables-discretas/grouped-discrete-descriptive-stats"
import {
  computeGroupedDiscreteFrequencyTable,
  type GroupedDiscreteFrequencyRow,
  type GroupedDiscreteInputRow,
} from "@/solvers/variables-discretas/grouped-discrete-frequency-table"
import { Button } from "@workspace/ui/components/button"
import { FieldError } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Separator } from "@workspace/ui/components/separator"

export const Route = createFileRoute(
  "/estadisticas/variables-discretas-agrupadas"
)({
  component: VariablesDiscretasAgrupadasPage,
})

type EditableGroupedRow = {
  id: string
  value: string
  frequency: string
}

type EditableGroupedComputedRow = EditableGroupedRow & {
  item: number
  computed: GroupedDiscreteFrequencyRow | null
}

type DerivedGroupedTableState = {
  rows: EditableGroupedComputedRow[]
  error: string | null
  totalFrequency: number | null
  classCount: number | null
  stats: GroupedDiscreteDescriptiveStats | null
}

function newEditableRow(): EditableGroupedRow {
  return {
    id: crypto.randomUUID(),
    value: "",
    frequency: "",
  }
}

function fmtNumber(value: number, digits = 4): string {
  return new Intl.NumberFormat("es", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value)
}

function fmtRelative(value: number): string {
  return new Intl.NumberFormat("es", {
    maximumFractionDigits: 4,
    minimumFractionDigits: 4,
  }).format(value)
}

function formatCvDecimalAndPercent(cv: number | null, empty = "—"): string {
  if (cv === null) {
    return empty
  }

  const dec = fmtNumber(cv)
  const pct = new Intl.NumberFormat("es", {
    style: "percent",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(cv)

  return `${dec} (${pct})`
}

function formatGroupedMedian(stats: GroupedDiscreteDescriptiveStats): string {
  return Array.isArray(stats.mediana)
    ? stats.mediana.map((value) => fmtNumber(value)).join(" y ")
    : fmtNumber(stats.mediana as number)
}

function formatGroupedMode(stats: GroupedDiscreteDescriptiveStats): string {
  if (stats.moda.length === 0) {
    return "Sin moda clara (misma frecuencia para todos)"
  }

  return stats.moda.map((value) => fmtNumber(value)).join(", ")
}

function parseFractilePercent(raw: string): number | null {
  const parsed = parseNumericToken(raw)
  if (parsed === null || parsed <= 0 || parsed > 100) {
    return null
  }

  return parsed / 100
}

function formatDiscreteFractileResult(
  result: number | readonly [number, number] | null
): string {
  if (result === null) {
    return "—"
  }

  if (Array.isArray(result)) {
    return result.map((value) => fmtNumber(value)).join(" y ")
  }

  if (typeof result === "number") {
    return fmtNumber(result)
  }

  return "—"
}

function alignedLatex(lines: readonly string[]): string {
  return `\\begin{gathered}${lines.join(" \\\\[8pt] ")}\\end{gathered}`
}

function parsePositiveInteger(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }

  const parsed = Number(trimmed)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

function emptyDerivedRows(
  rows: readonly EditableGroupedRow[]
): EditableGroupedComputedRow[] {
  return rows.map((row, index) => ({
    ...row,
    item: index + 1,
    computed: null,
  }))
}

function buildDerivedGroupedTableState(
  rows: readonly EditableGroupedRow[]
): DerivedGroupedTableState {
  const preparedRows: GroupedDiscreteInputRow[] = []
  const preparedIndexes: number[] = []
  let error: string | null = null

  for (const [index, row] of rows.entries()) {
    const hasValue = row.value.trim() !== ""
    const hasFrequency = row.frequency.trim() !== ""

    if (!hasValue && !hasFrequency) {
      continue
    }

    if (!hasValue || !hasFrequency) {
      error ??= `Completá valor observado y frecuencia absoluta en la fila ${index + 1}.`
      continue
    }

    const value = parseNumericToken(row.value)
    if (value === null) {
      error ??= `La fila ${index + 1} tiene un valor observado no numérico.`
      continue
    }

    const frequency = parsePositiveInteger(row.frequency)
    if (frequency === null) {
      error ??= `La fila ${index + 1} debe tener una frecuencia absoluta entera mayor que 0.`
      continue
    }

    preparedRows.push({ value, frequency })
    preparedIndexes.push(index)
  }

  if (preparedRows.length === 0) {
    return {
      rows: emptyDerivedRows(rows),
      error,
      totalFrequency: null,
      classCount: null,
      stats: null,
    }
  }

  const computed = computeGroupedDiscreteFrequencyTable(preparedRows)
  if ("error" in computed) {
    return {
      rows: emptyDerivedRows(rows),
      error: computed.error,
      totalFrequency: null,
      classCount: null,
      stats: null,
    }
  }

  const descriptiveStats =
    computeGroupedDiscreteDescriptiveStatsFromFrequencyTable(computed)
  if ("error" in descriptiveStats) {
    return {
      rows: emptyDerivedRows(rows),
      error: descriptiveStats.error,
      totalFrequency: null,
      classCount: null,
      stats: null,
    }
  }

  const computedByIndex = new Map<number, GroupedDiscreteFrequencyRow>()
  preparedIndexes.forEach((rowIndex, computedIndex) => {
    const computedRow = computed.rows[computedIndex]
    if (computedRow) {
      computedByIndex.set(rowIndex, computedRow)
    }
  })

  return {
    rows: rows.map((row, index) => ({
      ...row,
      item: index + 1,
      computed: computedByIndex.get(index) ?? null,
    })),
    error,
    totalFrequency: computed.totalFrequency,
    classCount: computed.classCount,
    stats: descriptiveStats,
  }
}

function MathHeader({ label, math }: { label: string; math: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span>{label}</span>
      <span className="text-[11px] font-normal text-muted-foreground normal-case">
        <InlineMath math={math} />
      </span>
    </div>
  )
}

function ComputedCell({
  value,
  formatter = fmtNumber,
}: {
  value: number | null
  formatter?: (value: number) => string
}) {
  return (
    <span className="font-mono tabular-nums">
      {value === null ? "—" : formatter(value)}
    </span>
  )
}

function groupedStatFormulaProps(
  statId:
    | "media"
    | "mediana"
    | "moda"
    | "desvioMedio"
    | "rango"
    | "varianza"
    | "cuasiVarianza"
    | "desvioEstandar"
    | "cuasiDesvioEstandar"
    | "coeficienteVariacion"
    | "coeficienteAsimetria"
    | "coeficienteCurtosis",
  title: string,
  stats: GroupedDiscreteDescriptiveStats
): StatFormulaDialogProps | null {
  if (statId === "media") {
    const general = "\\bar{r} = \\dfrac{1}{n}\\sum_{i=1}^{k} r_i f_{ai}"
    const terms = stats.rows
      .map((row) => `${latexNum(row.value)}\\cdot${row.absoluteFrequency}`)
      .join("+")
    const substituted =
      stats.rows.length <= 8
        ? alignedLatex([
            `\\bar{r} = \\dfrac{${terms}}{${stats.n}}`,
            `\\bar{r} = \\dfrac{${latexNum(stats.sumaProductos)}}{${stats.n}} = ${latexNum(stats.media)}`,
          ])
        : alignedLatex([
            `\\bar{r} = \\dfrac{1}{${stats.n}}\\sum_{i=1}^{${stats.rows.length}} r_i f_{ai}`,
            `\\bar{r} = \\dfrac{${latexNum(stats.sumaProductos)}}{${stats.n}} = ${latexNum(stats.media)}`,
          ])

    return {
      title,
      generalLatex: general,
      substitutedLatex: substituted,
      explanation:
        "La media para datos agrupados por valores se obtiene sumando cada valor observado multiplicado por su frecuencia absoluta y dividiendo por n.",
    }
  }

  if (statId === "moda") {
    const general =
      "Mo = r_i \\text{ tal que } f_{ai} = \\max(f_{a1},\\dots,f_{ak})"
    const frequencies = stats.rows
      .map((row) => `f_a(${latexNum(row.value)})=${row.absoluteFrequency}`)
      .join(",\\;")

    if (stats.moda.length === 0) {
      return {
        title,
        generalLatex: general,
        substitutedLatex: alignedLatex([
          frequencies,
          "\\text{todas las frecuencias son iguales, no hay moda clara.}",
        ]),
        explanation:
          "La moda es el valor observado con frecuencia absoluta máxima. Si todas las frecuencias coinciden, no hay una moda clara.",
      }
    }

    return {
      title,
      generalLatex: general,
      substitutedLatex: alignedLatex([
        frequencies,
        `Mo \\in \\{${stats.moda.map((value) => latexNum(value)).join(",\\;")}\\}`,
      ]),
      explanation:
        "La moda es el valor observado con frecuencia absoluta máxima. Puede haber más de una moda.",
    }
  }

  if (statId === "desvioMedio") {
    return {
      title,
      generalLatex:
        "DM = \\dfrac{1}{n}\\sum_{i=1}^{k} f_{ai}\\left|r_i-\\bar{r}\\right|",
      substitutedLatex: alignedLatex([
        `DM = \\dfrac{${latexNum(stats.sumaDesviosAbsolutos)}}{${stats.n}}`,
        `DM = ${latexNum(stats.desvioMedio)}`,
      ]),
      explanation:
        "El desvío medio pondera las desviaciones absolutas respecto de la media y las divide por n.",
    }
  }

  if (statId === "rango") {
    const min = stats.rows[0]?.value
    const max = stats.rows[stats.rows.length - 1]?.value
    if (min === undefined || max === undefined) {
      return null
    }

    return {
      title,
      generalLatex: "R = r_{max} - r_{min}",
      substitutedLatex: alignedLatex([
        `R = ${latexNum(max)} - ${latexNum(min)}`,
        `R = ${latexNum(stats.rango)}`,
      ]),
      explanation:
        "El rango es la diferencia entre el mayor y el menor valor observado de la tabla.",
    }
  }

  if (statId === "varianza") {
    const general =
      "\\sigma^2 = \\dfrac{1}{n}\\sum_{i=1}^{k} f_{ai}(r_i-\\bar{r})^2"
    const terms = stats.rows
      .map(
        (row) =>
          `${row.absoluteFrequency}\\cdot(${latexNum(row.value)}-${latexNum(
            stats.media
          )})^2`
      )
      .join("+")
    const substituted =
      stats.rows.length <= 6
        ? alignedLatex([
            `\\sigma^2 = \\dfrac{${terms}}{${stats.n}}`,
            `\\sigma^2 = \\dfrac{${latexNum(stats.sumaCuadradosDesvios)}}{${stats.n}} = ${latexNum(stats.varianza)}`,
          ])
        : alignedLatex([
            `\\sigma^2 = \\dfrac{1}{${stats.n}}\\sum_{i=1}^{${stats.rows.length}} f_{ai}(r_i-\\bar{r})^2`,
            `\\sigma^2 = \\dfrac{${latexNum(stats.sumaCuadradosDesvios)}}{${stats.n}} = ${latexNum(stats.varianza)}`,
          ])

    return {
      title,
      generalLatex: general,
      substitutedLatex: substituted,
      explanation:
        "La varianza poblacional pondera cada desvío cuadrático por su frecuencia absoluta y divide por n.",
    }
  }

  if (statId === "cuasiVarianza") {
    const general =
      "s^2 = \\dfrac{1}{n-1}\\sum_{i=1}^{k} f_{ai}(r_i-\\bar{r})^2"

    if (stats.cuasiVarianza === null) {
      return {
        title,
        generalLatex: general,
        substitutedLatex: `n = ${stats.n} < 2 \\Rightarrow s^2\\ \\text{no se define.}`,
        explanation:
          "La cuasi-varianza usa la misma suma ponderada de desvíos cuadrados, pero divide por n - 1.",
      }
    }

    const terms = stats.rows
      .map(
        (row) =>
          `${row.absoluteFrequency}\\cdot(${latexNum(row.value)}-${latexNum(
            stats.media
          )})^2`
      )
      .join("+")
    const substituted =
      stats.rows.length <= 6
        ? alignedLatex([
            `s^2 = \\dfrac{${terms}}{${stats.n - 1}}`,
            `s^2 = \\dfrac{${latexNum(stats.sumaCuadradosDesvios)}}{${stats.n - 1}} = ${latexNum(stats.cuasiVarianza)}`,
          ])
        : alignedLatex([
            `s^2 = \\dfrac{1}{${stats.n - 1}}\\sum_{i=1}^{${stats.rows.length}} f_{ai}(r_i-\\bar{r})^2`,
            `s^2 = \\dfrac{${latexNum(stats.sumaCuadradosDesvios)}}{${stats.n - 1}} = ${latexNum(stats.cuasiVarianza)}`,
          ])

    return {
      title,
      generalLatex: general,
      substitutedLatex: substituted,
      explanation:
        "La cuasi-varianza muestral pondera cada desvío cuadrático por su frecuencia absoluta y divide por n - 1.",
    }
  }

  if (statId === "desvioEstandar") {
    return {
      title,
      generalLatex: "\\sigma = \\sqrt{\\sigma^2}",
      substitutedLatex: `\\sigma = \\sqrt{${latexNum(
        stats.varianza
      )}} = ${latexNum(stats.desvioEstandar)}`,
      explanation:
        "El desvío estándar poblacional es la raíz cuadrada de la varianza poblacional.",
    }
  }

  if (statId === "cuasiDesvioEstandar") {
    if (stats.cuasiDesvioEstandar === null) {
      return {
        title,
        generalLatex: "s = \\sqrt{s^2}",
        substitutedLatex: `n = ${stats.n} < 2 \\Rightarrow s\\ \\text{no se define.}`,
        explanation:
          "El cuasi-desvío estándar es la raíz cuadrada de la cuasi-varianza.",
      }
    }

    return {
      title,
      generalLatex: "s = \\sqrt{s^2}",
      substitutedLatex: `s = \\sqrt{${latexNum(
        stats.cuasiVarianza ?? 0
      )}} = ${latexNum(stats.cuasiDesvioEstandar)}`,
      explanation:
        "El cuasi-desvío estándar es la raíz cuadrada de la cuasi-varianza.",
    }
  }

  if (statId === "coeficienteVariacion") {
    const general =
      "\\mathrm{CV}_\\sigma = \\dfrac{\\sigma}{|\\bar{r}|},\\quad \\mathrm{CV}_s = \\dfrac{s}{|\\bar{r}|}"

    if (Math.abs(stats.media) <= Number.EPSILON) {
      return {
        title,
        generalLatex: general,
        substitutedLatex:
          "\\bar{r} = 0 \\Rightarrow \\mathrm{CV}_\\sigma\\ \\text{y}\\ \\mathrm{CV}_s\\ \\text{no se definen.}",
        explanation:
          "El coeficiente de variación compara el desvío con la media en valor absoluto.",
      }
    }

    if (
      stats.cuasiDesvioEstandar === null ||
      stats.coeficienteVariacionMuestral === null
    ) {
      return {
        title,
        generalLatex: general,
        substitutedLatex: alignedLatex([
          `\\mathrm{CV}_\\sigma = \\dfrac{${latexNum(stats.desvioEstandar)}}{|${latexNum(stats.media)}|} = ${latexNum(stats.coeficienteVariacionPoblacional ?? 0)}\\ (${latexNum((stats.coeficienteVariacionPoblacional ?? 0) * 100)}\\%)`,
          "n < 2 \\Rightarrow \\mathrm{CV}_s\\ \\text{no aplica.}",
        ]),
        explanation:
          "El coeficiente de variación compara el desvío con la media en valor absoluto.",
      }
    }

    return {
      title,
      generalLatex: general,
      substitutedLatex: alignedLatex([
        `\\mathrm{CV}_\\sigma = \\dfrac{${latexNum(stats.desvioEstandar)}}{|${latexNum(stats.media)}|} = ${latexNum(stats.coeficienteVariacionPoblacional ?? 0)}\\ (${latexNum((stats.coeficienteVariacionPoblacional ?? 0) * 100)}\\%)`,
        `\\mathrm{CV}_s = \\dfrac{${latexNum(stats.cuasiDesvioEstandar)}}{|${latexNum(stats.media)}|} = ${latexNum(stats.coeficienteVariacionMuestral)}\\ (${latexNum(stats.coeficienteVariacionMuestral * 100)}\\%)`,
      ]),
      explanation:
        "El coeficiente de variación compara el desvío con la media en valor absoluto.",
    }
  }

  if (statId === "coeficienteAsimetria") {
    const general =
      "As = \\dfrac{\\dfrac{1}{n}\\sum_{i=1}^{k} f_{ai}(r_i-\\bar{r})^3}{\\sigma^3}"

    if (stats.coeficienteAsimetria === null) {
      return {
        title,
        generalLatex: general,
        substitutedLatex:
          "σ \\approx 0 \\Rightarrow As\\ \\text{no se calcula.}",
        explanation:
          "La asimetría usa el tercer momento central ponderado y lo estandariza con el desvío estándar poblacional al cubo.",
      }
    }

    const terms = stats.rows
      .map(
        (row) =>
          `${row.absoluteFrequency}\\cdot(${latexNum(row.value)}-${latexNum(
            stats.media
          )})^3`
      )
      .join("+")
    const substituted =
      stats.rows.length <= 6 && stats.sumaCubosDesvios !== null
        ? alignedLatex([
            `As = \\dfrac{\\dfrac{${terms}}{${stats.n}}}{${latexNum(stats.desvioEstandar ** 3)}}`,
            `As = \\dfrac{${latexNum(stats.momentoCentral3 ?? 0)}}{${latexNum(stats.desvioEstandar ** 3)}} = ${latexNum(stats.coeficienteAsimetria)}`,
          ])
        : alignedLatex([
            `As = \\dfrac{\\dfrac{${latexNum(stats.sumaCubosDesvios ?? 0)}}{${stats.n}}}{${latexNum(stats.desvioEstandar ** 3)}}`,
            `As = ${latexNum(stats.coeficienteAsimetria)}`,
          ])

    return {
      title,
      generalLatex: general,
      substitutedLatex: substituted,
      explanation:
        "La asimetría usa el tercer momento central ponderado y lo estandariza con el desvío estándar poblacional al cubo.",
    }
  }

  if (statId === "coeficienteCurtosis") {
    const general =
      "Ku = \\dfrac{\\dfrac{1}{n}\\sum_{i=1}^{k} f_{ai}(r_i-\\bar{r})^4}{\\sigma^4}"

    if (stats.coeficienteCurtosis === null) {
      return {
        title,
        generalLatex: general,
        substitutedLatex:
          "σ \\approx 0 \\Rightarrow Ku\\ \\text{no se calcula.}",
        explanation:
          "La curtosis usa el cuarto momento central ponderado y lo estandariza con el desvío estándar poblacional a la cuarta.",
      }
    }

    const terms = stats.rows
      .map(
        (row) =>
          `${row.absoluteFrequency}\\cdot(${latexNum(row.value)}-${latexNum(
            stats.media
          )})^4`
      )
      .join("+")
    const substituted =
      stats.rows.length <= 6 && stats.sumaCuartosDesvios !== null
        ? alignedLatex([
            `Ku = \\dfrac{\\dfrac{${terms}}{${stats.n}}}{${latexNum(stats.desvioEstandar ** 4)}}`,
            `Ku = \\dfrac{${latexNum(stats.momentoCentral4 ?? 0)}}{${latexNum(stats.desvioEstandar ** 4)}} = ${latexNum(stats.coeficienteCurtosis)}`,
          ])
        : alignedLatex([
            `Ku = \\dfrac{\\dfrac{${latexNum(stats.sumaCuartosDesvios ?? 0)}}{${stats.n}}}{${latexNum(stats.desvioEstandar ** 4)}}`,
            `Ku = ${latexNum(stats.coeficienteCurtosis)}`,
          ])

    return {
      title,
      generalLatex: general,
      substitutedLatex: substituted,
      explanation:
        "La curtosis usa el cuarto momento central ponderado y lo estandariza con el desvío estándar poblacional a la cuarta.",
    }
  }

  const leftRow = stats.medianLeftRow
  const rightRow = stats.medianRightRow
  const leftPreviousRelative =
    leftRow.leftRelativeCumulativeFrequency - leftRow.relativeFrequency

  if (stats.n % 2 !== 0) {
    return {
      title,
      generalLatex: "Me = r_i \\text{ tal que } F_{i-1} < 0.5 \\leq F_i",
      substitutedLatex: alignedLatex([
        `F_{${leftRow.item - 1}} = ${latexNum(leftPreviousRelative, 4)} < 0.5`,
        `F_{${leftRow.item}} = ${latexNum(leftRow.leftRelativeCumulativeFrequency, 4)} \\geq 0.5 \\Rightarrow Me = ${latexNum(leftRow.value)}`,
      ]),
      explanation:
        "Si n es impar, la mediana es el valor cuya frecuencia acumulada relativa atraviesa el 0,5.",
    }
  }

  if (!Array.isArray(stats.mediana)) {
    return {
      title,
      generalLatex:
        "Me = r_{(n/2)} = r_{(n/2+1)} \\quad \\text{si ambas posiciones centrales coinciden}",
      substitutedLatex: alignedLatex([
        `r_{(${stats.medianLeftPosition})} = r_{(${stats.medianRightPosition})} = ${latexNum(leftRow.value)}`,
        `Me = ${latexNum(leftRow.value)}`,
      ]),
      explanation:
        "Si n es par y las dos posiciones centrales caen dentro del mismo valor observado, la mediana es ese valor.",
    }
  }

  return {
    title,
    generalLatex:
      "Me = r_{(n/2)}\\ \\text{y}\\ r_{(n/2+1)} \\quad \\text{si las posiciones centrales caen en valores distintos}",
    substitutedLatex: alignedLatex([
      `r_{(${stats.medianLeftPosition})} = ${latexNum(leftRow.value)},\\quad r_{(${stats.medianRightPosition})} = ${latexNum(rightRow.value)}`,
      `Me = ${latexNum(leftRow.value)}\\ \\text{y}\\ ${latexNum(rightRow.value)}`,
    ]),
    explanation:
      "Si n es par y las posiciones centrales quedan en dos valores distintos, la mediana queda comprendida entre ambos, como en la referencia.",
  }
}

function StatRow({
  label,
  value,
  hint,
  formula,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  formula?: StatFormulaDialogProps | null
}) {
  return (
    <div className="grid grid-cols-1 gap-0.5 border-b border-border py-2 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-4">
      <div>
        <span>{label}</span>
        {hint ? (
          <p className="text-xs leading-snug text-muted-foreground [&_.katex]:text-[0.95em]">
            {hint}
          </p>
        ) : null}
      </div>
      <div className="flex items-baseline justify-end gap-2">
        <div className="font-mono text-sm tabular-nums">{value}</div>
        {formula ? <StatFormulaDialog {...formula} /> : null}
      </div>
    </div>
  )
}

function VariablesDiscretasAgrupadasPage() {
  const [rows, setRows] = useState<EditableGroupedRow[]>([newEditableRow()])
  const [fractilePercent, setFractilePercent] = useState("50")

  function removeRow(rowId: string) {
    setRows((previousRows) => {
      const nextRows = previousRows.filter((row) => row.id !== rowId)
      return nextRows.length > 0 ? nextRows : [newEditableRow()]
    })
  }

  function updateRow(
    rowId: string,
    field: keyof Omit<EditableGroupedRow, "id">,
    value: string
  ) {
    setRows((previousRows) =>
      previousRows.map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row
      )
    )
  }

  const derived = useMemo(() => buildDerivedGroupedTableState(rows), [rows])

  const columns = useMemo<ColumnDef<EditableGroupedComputedRow>[]>(
    () => [
      {
        accessorKey: "item",
        header: "ID",
        cell: ({ row }) => (
          <span className="font-mono tabular-nums">{row.original.item}</span>
        ),
      },
      {
        id: "value",
        header: () => <MathHeader label="Valor observado" math="r_i" />,
        cell: ({ row }) => (
          <Input
            inputMode="decimal"
            placeholder="Ej. 4"
            className="h-8 min-w-20 px-2 text-xs md:text-sm"
            value={row.original.value}
            onChange={(event) =>
              updateRow(row.original.id, "value", event.currentTarget.value)
            }
          />
        ),
      },
      {
        id: "absoluteFrequency",
        header: () => <MathHeader label="Frecuencia absoluta" math="f_{ai}" />,
        cell: ({ row }) => (
          <Input
            inputMode="numeric"
            placeholder="Ej. 3"
            className="h-8 min-w-20 px-2 text-xs md:text-sm"
            value={row.original.frequency}
            onChange={(event) =>
              updateRow(row.original.id, "frequency", event.currentTarget.value)
            }
          />
        ),
        footer: () =>
          derived.totalFrequency === null ? null : (
            <InlineMath math={`\\sum f_{ai} = n = ${derived.totalFrequency}`} />
          ),
      },
      {
        id: "relativeFrequency",
        header: () => (
          <MathHeader
            label="Frecuencia relativa"
            math={"f_i = \\frac{f_{ai}}{n}"}
          />
        ),
        cell: ({ row }) => (
          <ComputedCell
            value={row.original.computed?.relativeFrequency ?? null}
            formatter={fmtRelative}
          />
        ),
        footer: () =>
          derived.totalFrequency === null ? null : (
            <InlineMath math={"\\sum f_i = 1"} />
          ),
      },
      {
        id: "leftAbsoluteCumulativeFrequency",
        header: () => (
          <MathHeader
            label="Frecuencia acumulada absoluta izquierda"
            math="F_{ai}"
          />
        ),
        cell: ({ row }) => (
          <ComputedCell
            value={
              row.original.computed?.leftAbsoluteCumulativeFrequency ?? null
            }
          />
        ),
      },
      {
        id: "leftRelativeCumulativeFrequency",
        header: () => (
          <MathHeader
            label="Frecuencia acumulada relativa izquierda"
            math="F_i"
          />
        ),
        cell: ({ row }) => (
          <ComputedCell
            value={
              row.original.computed?.leftRelativeCumulativeFrequency ?? null
            }
            formatter={fmtRelative}
          />
        ),
      },
      {
        id: "rightAbsoluteCumulativeFrequency",
        header: () => (
          <MathHeader
            label="Frecuencia acumulada absoluta derecha"
            math="G_{ai}"
          />
        ),
        cell: ({ row }) => (
          <ComputedCell
            value={
              row.original.computed?.rightAbsoluteCumulativeFrequency ?? null
            }
          />
        ),
      },
      {
        id: "rightRelativeCumulativeFrequency",
        header: () => (
          <MathHeader
            label="Frecuencia acumulada relativa derecha"
            math="G_i"
          />
        ),
        cell: ({ row }) => (
          <ComputedCell
            value={
              row.original.computed?.rightRelativeCumulativeFrequency ?? null
            }
            formatter={fmtRelative}
          />
        ),
      },
      {
        id: "actions",
        header: "Acciones",
        cell: ({ row }) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => removeRow(row.original.id)}
          >
            Eliminar
          </Button>
        ),
      },
    ],
    [derived.totalFrequency]
  )

  const table = useReactTable({
    data: derived.rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="flex max-w-7xl min-w-0 flex-col gap-6 text-sm leading-relaxed">
      <div>
        <h1 className="text-base font-medium">Variables Discretas Agrupadas</h1>
        <p className="mt-1 text-muted-foreground">
          Ingresá directamente en la tabla el valor observado y su frecuencia
          absoluta. También se calculan moda, dispersión, coeficiente de
          variación, asimetría, curtosis, desvío medio, rango y fractiles.
        </p>
      </div>

      <div className="rounded-md border border-border px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Las frecuencias acumuladas se calculan siguiendo el orden visible de
          la tabla, ingresar los valores de menor a mayor.
        </p>
        {derived.totalFrequency !== null && derived.classCount !== null ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Resumen actual:{" "}
            <InlineMath math={`n = ${derived.totalFrequency}`} /> y{" "}
            <InlineMath math={`k = ${derived.classCount}`} />.
          </p>
        ) : null}
      </div>

      <Separator />

      <div className="max-w-full min-w-0 overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[980px] border-collapse text-xs sm:text-sm">
          <thead className="bg-muted/40">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-2 py-1.5 text-left text-[11px] font-medium tracking-wide text-muted-foreground sm:px-2.5 sm:py-2"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-border last:border-b-0"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-2 py-1.5 align-middle sm:px-2.5 sm:py-2"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>

          <tfoot className="bg-muted/20">
            {table.getFooterGroups().map((footerGroup) => (
              <tr key={footerGroup.id} className="border-t border-border">
                {footerGroup.headers.map((header) => (
                  <td
                    key={header.id}
                    className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground sm:px-2.5 sm:py-2"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.footer,
                          header.getContext()
                        )}
                  </td>
                ))}
              </tr>
            ))}
          </tfoot>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setRows((previousRows) => [...previousRows, newEditableRow()])
          }
        >
          Agregar fila
        </Button>
      </div>

      {derived.error ? <FieldError>{derived.error}</FieldError> : null}

      {derived.stats ? (
        <div className="rounded-md border border-border px-4 py-2">
          <h2 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Resultados (n = {derived.stats.n})
          </h2>
          <div>
            <StatRow
              label="Media"
              value={fmtNumber(derived.stats.media)}
              formula={groupedStatFormulaProps("media", "Media", derived.stats)}
            />
            <StatRow
              label="Mediana"
              value={formatGroupedMedian(derived.stats)}
              hint={
                derived.stats.n % 2 === 0 ? (
                  <>
                    Si <InlineMath math="n" /> es par, se observan las dos
                    posiciones centrales <InlineMath math="r_{(n/2)}" /> y{" "}
                    <InlineMath math="r_{(n/2+1)}" />.
                  </>
                ) : (
                  <>
                    Si <InlineMath math="n" /> es impar, la mediana es el valor
                    cuya acumulada relativa cumple{" "}
                    <InlineMath math="F_{i-1} \leq 0{,}5 \leq F_i" />
                  </>
                )
              }
              formula={groupedStatFormulaProps(
                "mediana",
                "Mediana",
                derived.stats
              )}
            />
            <StatRow
              label="Moda"
              value={formatGroupedMode(derived.stats)}
              formula={groupedStatFormulaProps("moda", "Moda", derived.stats)}
            />
            <StatRow
              label="Desvío medio"
              value={fmtNumber(derived.stats.desvioMedio)}
              formula={groupedStatFormulaProps(
                "desvioMedio",
                "Desvío medio",
                derived.stats
              )}
            />
            <StatRow
              label="Rango"
              value={fmtNumber(derived.stats.rango)}
              formula={groupedStatFormulaProps("rango", "Rango", derived.stats)}
            />
            <StatRow
              label="Varianza"
              value={fmtNumber(derived.stats.varianza)}
              formula={groupedStatFormulaProps(
                "varianza",
                "Varianza poblacional",
                derived.stats
              )}
            />
            <StatRow
              label="Cuasi-varianza"
              value={
                derived.stats.cuasiVarianza === null
                  ? "—"
                  : fmtNumber(derived.stats.cuasiVarianza)
              }
              formula={groupedStatFormulaProps(
                "cuasiVarianza",
                "Cuasi-varianza muestral",
                derived.stats
              )}
            />
            <StatRow
              label="Desvío estándar"
              value={fmtNumber(derived.stats.desvioEstandar)}
              formula={groupedStatFormulaProps(
                "desvioEstandar",
                "Desvío estándar poblacional",
                derived.stats
              )}
            />
            <StatRow
              label="Cuasi-desvío estándar"
              value={
                derived.stats.cuasiDesvioEstandar === null
                  ? "—"
                  : fmtNumber(derived.stats.cuasiDesvioEstandar)
              }
              formula={groupedStatFormulaProps(
                "cuasiDesvioEstandar",
                "Cuasi-desvío estándar muestral",
                derived.stats
              )}
            />
            <StatRow
              label="Coeficiente de variación"
              value={
                <div className="flex flex-col items-end gap-1.5">
                  <div className="text-right">
                    Poblacional:{" "}
                    {formatCvDecimalAndPercent(
                      derived.stats.coeficienteVariacionPoblacional
                    )}
                  </div>
                  <div className="text-right">
                    Muestral:{" "}
                    {formatCvDecimalAndPercent(
                      derived.stats.coeficienteVariacionMuestral
                    )}
                  </div>
                </div>
              }
              formula={groupedStatFormulaProps(
                "coeficienteVariacion",
                "Coeficiente de variación",
                derived.stats
              )}
            />
            <StatRow
              label="Coeficiente de asimetría"
              value={
                derived.stats.coeficienteAsimetria === null
                  ? "—"
                  : fmtNumber(derived.stats.coeficienteAsimetria)
              }
              formula={groupedStatFormulaProps(
                "coeficienteAsimetria",
                "Coeficiente de asimetría",
                derived.stats
              )}
            />
            <StatRow
              label="Coeficiente de curtosis"
              value={
                derived.stats.coeficienteCurtosis === null
                  ? "—"
                  : fmtNumber(derived.stats.coeficienteCurtosis)
              }
              formula={groupedStatFormulaProps(
                "coeficienteCurtosis",
                "Coeficiente de curtosis",
                derived.stats
              )}
            />
          </div>
        </div>
      ) : null}

      {derived.stats ? (
        <div className="rounded-md border border-border px-4 py-3">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Fractil
          </h2>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full max-w-xs">
              <label
                htmlFor="grouped-discrete-fractile-percent"
                className="text-xs font-medium text-muted-foreground"
              >
                Porcentaje acumulado a la izquierda
              </label>
              <Input
                id="grouped-discrete-fractile-percent"
                inputMode="decimal"
                className="mt-1"
                value={fractilePercent}
                onChange={(event) =>
                  setFractilePercent(event.currentTarget.value)
                }
                placeholder="Ej. 90"
              />
            </div>
            <div className="min-w-0 flex-1 rounded-md bg-muted/30 px-3 py-2">
              <div className="text-xs text-muted-foreground">
                {parseFractilePercent(fractilePercent) === null
                  ? "Ingresá un porcentaje entre 0 y 100."
                  : `Fractil del ${fmtNumber((parseFractilePercent(fractilePercent) ?? 0) * 100, 2)}%`}
              </div>
              <div className="font-mono text-sm tabular-nums">
                {formatDiscreteFractileResult(
                  computeGroupedDiscreteFractile(
                    derived.stats.rows,
                    parseFractilePercent(fractilePercent) ?? 0
                  )
                )}
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Si el porcentual cae exactamente en un salto de la acumulada, el
            fractil puede quedar comprendido entre dos valores consecutivos.
          </p>
        </div>
      ) : null}
    </div>
  )
}
