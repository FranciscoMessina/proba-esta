import { createFileRoute } from "@tanstack/react-router"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { useCallback, useMemo, useState, type ReactNode } from "react"
import { InlineMath } from "react-katex"

import {
  StatFormulaDialog,
  type StatFormulaDialogProps,
} from "@/components/stat-formula-dialog"
import { parseNumericToken } from "@/solvers/variables-discretas/discrete-descriptive-stats"
import { latexNum } from "@/solvers/variables-discretas/discrete-stat-formula-latex"
import {
  computeGroupedContinuousDescriptiveStatsFromFrequencyTable,
  resolveGroupedContinuousFractile,
  resolveGroupedContinuousInverseFractile,
  type GroupedContinuousDescriptiveStats,
} from "@/solvers/variables-continuas/grouped-continuous-descriptive-stats"
import {
  computeGroupedContinuousFrequencyTable,
  type GroupedContinuousFrequencyRow,
  type GroupedContinuousInputRow,
} from "@/solvers/variables-continuas/grouped-continuous-frequency-table"
import { Button } from "@workspace/ui/components/button"
import { FieldError } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Separator } from "@workspace/ui/components/separator"

export const Route = createFileRoute("/estadisticas/variables-continuas")({
  component: VariablesContinuasPage,
})

type EditableContinuousRow = {
  id: string
  lowerLimit: string
  upperLimit: string
  frequency: string
}

type EditableContinuousComputedRow = EditableContinuousRow & {
  item: number
  computed: GroupedContinuousFrequencyRow | null
}

type DerivedContinuousTableState = {
  rows: EditableContinuousComputedRow[]
  error: string | null
  totalFrequency: number | null
  classCount: number | null
  stats: GroupedContinuousDescriptiveStats | null
}

type ContinuousTableMeta = {
  totalFrequency: number | null
  media: number | null
}

function newEditableRow(): EditableContinuousRow {
  return {
    id: crypto.randomUUID(),
    lowerLimit: "",
    upperLimit: "",
    frequency: "",
  }
}

function fmtNumber(value: number, digits = 4): string {
  return new Intl.NumberFormat("es", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value)
}

function fmtOptionalNumber(
  value: number | null | undefined,
  digits = 4,
  empty = "—",
): string {
  if (value === null || value === undefined) {
    return empty
  }

  return fmtNumber(value, digits)
}

function fmtRelative(value: number): string {
  return new Intl.NumberFormat("es", {
    maximumFractionDigits: 4,
    minimumFractionDigits: 4,
  }).format(value)
}

function fmtPercent(value: number, digits = 2): string {
  return new Intl.NumberFormat("es", {
    style: "percent",
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
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

function formatInterval(row: Pick<GroupedContinuousFrequencyRow, "lowerLimit" | "upperLimit">): string {
  return `${fmtNumber(row.lowerLimit)} - ${fmtNumber(row.upperLimit)}`
}

function formatModalIntervals(stats: GroupedContinuousDescriptiveStats): string {
  if (stats.modalRows.length === 0) {
    return "Sin intervalo modal claro (misma frecuencia para todos)"
  }

  return stats.modalRows.map((row) => formatInterval(row)).join(", ")
}

function parseFractilePercent(raw: string): number | null {
  const parsed = parseNumericToken(raw)
  if (parsed === null || parsed <= 0 || parsed > 100) {
    return null
  }

  return parsed / 100
}

function alignedLatex(lines: readonly string[]): string {
  return `\\begin{gathered}${lines.join(" \\\\[8pt] ")}\\end{gathered}`
}

function latexInterval(
  row: Pick<GroupedContinuousFrequencyRow, "lowerLimit" | "upperLimit">
): string {
  return `\\left[${latexNum(row.lowerLimit)},\\,${latexNum(row.upperLimit)}\\right)`
}

function parsePositiveNumber(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

function emptyDerivedRows(
  rows: readonly EditableContinuousRow[]
): EditableContinuousComputedRow[] {
  return rows.map((row, index) => ({
    ...row,
    item: index + 1,
    computed: null,
  }))
}

function buildDerivedContinuousTableState(
  rows: readonly EditableContinuousRow[]
): DerivedContinuousTableState {
  const preparedRows: GroupedContinuousInputRow[] = []
  const preparedIndexes: number[] = []
  let error: string | null = null

  for (const [index, row] of rows.entries()) {
    const hasLower = row.lowerLimit.trim() !== ""
    const hasUpper = row.upperLimit.trim() !== ""
    const hasFrequency = row.frequency.trim() !== ""

    if (!hasLower && !hasUpper && !hasFrequency) {
      continue
    }

    if (!hasLower || !hasUpper || !hasFrequency) {
      error ??=
        `Completá límite inferior, límite superior y frecuencia absoluta en la fila ${index + 1}.`
      continue
    }

    const lowerLimit = parseNumericToken(row.lowerLimit)
    if (lowerLimit === null) {
      error ??= `La fila ${index + 1} tiene un límite inferior no numérico.`
      continue
    }

    const upperLimit = parseNumericToken(row.upperLimit)
    if (upperLimit === null) {
      error ??= `La fila ${index + 1} tiene un límite superior no numérico.`
      continue
    }

    const frequency = parsePositiveNumber(row.frequency)
    if (frequency === null) {
      error ??= `La fila ${index + 1} debe tener una frecuencia absoluta numérica mayor que 0.`
      continue
    }

    preparedRows.push({ lowerLimit, upperLimit, frequency })
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

  const computed = computeGroupedContinuousFrequencyTable(preparedRows)
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
    computeGroupedContinuousDescriptiveStatsFromFrequencyTable(computed)
  if ("error" in descriptiveStats) {
    return {
      rows: emptyDerivedRows(rows),
      error: descriptiveStats.error,
      totalFrequency: null,
      classCount: null,
      stats: null,
    }
  }

  const computedByIndex = new Map<number, GroupedContinuousFrequencyRow>()
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

function MathHeader({
  label,
  math,
  mathClassName = "",
}: {
  label: string
  math: string
  mathClassName?: string
}) {
  return (
    <div className="flex flex-col gap-0.5 leading-tight">
      <span className="leading-tight">{label}</span>
      <span
        className={`text-[11px] leading-none font-normal text-muted-foreground normal-case ${mathClassName}`.trim()}
      >
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

function getContinuousTableColumnClassName(columnId: string): string {
  if (
    columnId === "lowerLimit" ||
    columnId === "upperLimit" ||
    columnId === "absoluteFrequency"
  ) {
    return "w-[88px] min-w-[88px]"
  }

  if (
    columnId === "leftAbsoluteCumulativeFrequency" ||
    columnId === "leftRelativeCumulativeFrequency" ||
    columnId === "rightAbsoluteCumulativeFrequency" ||
    columnId === "rightRelativeCumulativeFrequency"
  ) {
    return "w-[80px] min-w-[80px]"
  }

  if (columnId === "weightedSquaredMeanDeviation") {
    return "w-[152px] min-w-[152px]"
  }

  return ""
}

function continuousStatFormulaProps(
  statId:
    | "media"
    | "mediana"
    | "intervaloModal"
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
  stats: GroupedContinuousDescriptiveStats
): StatFormulaDialogProps | null {
  if (statId === "media") {
    const general = "\\bar{x} = \\dfrac{1}{n}\\sum_{i=1}^{k} C_i f_{ai}"
    const terms = stats.rows
      .map((row) => `${latexNum(row.classMark)}\\cdot${row.absoluteFrequency}`)
      .join("+")
    const substituted =
      stats.rows.length <= 8
        ? alignedLatex([
          `\\bar{x} = \\dfrac{${terms}}{${stats.n}}`,
          `\\bar{x} = \\dfrac{${latexNum(stats.sumaProductos)}}{${stats.n}} = ${latexNum(stats.media)}`,
        ])
        : alignedLatex([
          `\\bar{x} = \\dfrac{1}{${stats.n}}\\sum_{i=1}^{${stats.rows.length}} C_i f_{ai}`,
          `\\bar{x} = \\dfrac{${latexNum(stats.sumaProductos)}}{${stats.n}} = ${latexNum(stats.media)}`,
        ])

    return {
      title,
      generalLatex: general,
      substitutedLatex: substituted,
      explanation:
        "La media para variables continuas agrupadas se aproxima usando la marca de clase de cada intervalo, ponderada por su frecuencia absoluta.",
    }
  }

  if (statId === "mediana") {
    const medianRow = stats.medianRow

    return {
      title,
      generalLatex:
        "Me = L_{inf,e} + A_e\\left(\\dfrac{\\frac{n}{2}-F_{a(e-1)}}{f_{ae}}\\right)",
      substitutedLatex: alignedLatex([
        `I_e = ${latexInterval(medianRow)}`,
        `Me = ${latexNum(medianRow.lowerLimit)} + ${latexNum(medianRow.amplitude)}\\left(\\dfrac{\\frac{${stats.n}}{2}-${latexNum(stats.medianPreviousAbsoluteCumulativeFrequency)}}{${medianRow.absoluteFrequency}}\\right)`,
        `Me = ${latexNum(stats.mediana)}`,
      ]),
      explanation:
        "La mediana se obtiene por interpolación lineal dentro del intervalo mediano, usando la frecuencia acumulada anterior y la amplitud del intervalo.",
    }
  }

  if (statId === "intervaloModal") {
    const general =
      "I_o = I_i \\text{ tal que } f_{ai} = \\max(f_{a1},\\dots,f_{ak})"

    if (stats.modalRows.length === 0) {
      return {
        title,
        generalLatex: general,
        substitutedLatex:
          "\\text{Todas las frecuencias absolutas son iguales, por eso no hay un intervalo modal claro.}",
        explanation:
          "El intervalo modal es el de mayor frecuencia absoluta. Si todas las frecuencias coinciden, no hay un intervalo modal claro.",
      }
    }

    return {
      title,
      generalLatex: general,
      substitutedLatex: alignedLatex([
        stats.rows
          .map(
            (row) => `${latexInterval(row)}\\colon f_a = ${row.absoluteFrequency}`
          )
          .join(",\\;"),
        `I_o \\in \\{${stats.modalRows.map((row) => latexInterval(row)).join(",\\;")}\\}`,
      ]),
      explanation:
        "El intervalo modal es el que concentra la mayor frecuencia absoluta dentro de la tabla agrupada.",
    }
  }

  if (statId === "desvioMedio") {
    return {
      title,
      generalLatex:
        "DM = \\dfrac{1}{n}\\sum_{i=1}^{k} f_{ai}\\left|C_i-\\bar{x}\\right|",
      substitutedLatex: alignedLatex([
        `DM = \\dfrac{${latexNum(stats.sumaDesviosAbsolutos)}}{${stats.n}}`,
        `DM = ${latexNum(stats.desvioMedio)}`,
      ]),
      explanation:
        "El desvío medio usa las desviaciones absolutas de las marcas de clase respecto de la media, ponderadas por frecuencia.",
    }
  }

  if (statId === "rango") {
    const firstRow = stats.rows[0]
    const lastRow = stats.rows[stats.rows.length - 1]
    if (!firstRow || !lastRow) {
      return null
    }

    return {
      title,
      generalLatex: "R = L_{sup,max} - L_{inf,min}",
      substitutedLatex: alignedLatex([
        `R = ${latexNum(lastRow.upperLimit)} - ${latexNum(firstRow.lowerLimit)}`,
        `R = ${latexNum(stats.rango)}`,
      ]),
      explanation:
        "El rango se toma como la amplitud total cubierta por los intervalos observados.",
    }
  }

  if (statId === "varianza") {
    const general =
      "\\sigma^2 = \\dfrac{1}{n}\\sum_{i=1}^{k} f_{ai}(C_i-\\bar{x})^2"
    const terms = stats.rows
      .map(
        (row) =>
          `${row.absoluteFrequency}\\cdot(${latexNum(row.classMark)}-${latexNum(
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
          `\\sigma^2 = \\dfrac{1}{${stats.n}}\\sum_{i=1}^{${stats.rows.length}} f_{ai}(C_i-\\bar{x})^2`,
          `\\sigma^2 = \\dfrac{${latexNum(stats.sumaCuadradosDesvios)}}{${stats.n}} = ${latexNum(stats.varianza)}`,
        ])

    return {
      title,
      generalLatex: general,
      substitutedLatex: substituted,
      explanation:
        "La varianza poblacional se calcula con los desvíos cuadrados de las marcas de clase respecto de la media, ponderados por la frecuencia.",
    }
  }

  if (statId === "cuasiVarianza") {
    const general =
      "s^2 = \\dfrac{1}{n-1}\\sum_{i=1}^{k} f_{ai}(C_i-\\bar{x})^2"

    if (stats.cuasiVarianza === null) {
      return {
        title,
        generalLatex: general,
        substitutedLatex: `n = ${stats.n} < 2 \\Rightarrow s^2\\ \\text{no se define.}`,
        explanation:
          "La cuasi-varianza usa la misma suma ponderada de desvíos cuadrados, pero divide por n - 1.",
      }
    }

    return {
      title,
      generalLatex: general,
      substitutedLatex: alignedLatex([
        `s^2 = \\dfrac{${latexNum(stats.sumaCuadradosDesvios)}}{${stats.n - 1}}`,
        `s^2 = ${latexNum(stats.cuasiVarianza)}`,
      ]),
      explanation:
        "La cuasi-varianza es la corrección muestral de la varianza cuando se trabaja con una muestra.",
    }
  }

  if (statId === "desvioEstandar") {
    return {
      title,
      generalLatex: "\\sigma = \\sqrt{\\sigma^2}",
      substitutedLatex: `\\sigma = \\sqrt{${latexNum(stats.varianza)}} = ${latexNum(stats.desvioEstandar)}`,
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

  if (statId === "coeficienteAsimetria") {
    const general =
      "As = \\dfrac{\\dfrac{1}{n}\\sum_{i=1}^{k} f_{ai}(C_i-\\bar{x})^3}{\\sigma^3}"

    if (stats.coeficienteAsimetria === null) {
      return {
        title,
        generalLatex: general,
        substitutedLatex:
          "σ \\approx 0 \\Rightarrow As\\ \\text{no se calcula.}",
        explanation:
          "La asimetría usa el tercer momento central ponderado y lo estandariza con el desvío estándar al cubo.",
      }
    }

    const terms = stats.rows
      .map(
        (row) =>
          `${row.absoluteFrequency}\\cdot(${latexNum(row.classMark)}-${latexNum(
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
        "La asimetría usa el tercer momento central ponderado y lo estandariza con el desvío estándar al cubo.",
    }
  }

  if (statId === "coeficienteCurtosis") {
    const general =
      "Ku = \\dfrac{\\dfrac{1}{n}\\sum_{i=1}^{k} f_{ai}(C_i-\\bar{x})^4}{\\sigma^4}"

    if (stats.coeficienteCurtosis === null) {
      return {
        title,
        generalLatex: general,
        substitutedLatex:
          "σ \\approx 0 \\Rightarrow Ku\\ \\text{no se calcula.}",
        explanation:
          "La curtosis usa el cuarto momento central ponderado y lo estandariza con el desvío estándar a la cuarta.",
      }
    }

    const terms = stats.rows
      .map(
        (row) =>
          `${row.absoluteFrequency}\\cdot(${latexNum(row.classMark)}-${latexNum(
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
        "La curtosis usa el cuarto momento central ponderado y lo estandariza con el desvío estándar a la cuarta.",
    }
  }

  const general =
    "\\mathrm{CV}_\\sigma = \\dfrac{\\sigma}{|\\bar{x}|},\\quad \\mathrm{CV}_s = \\dfrac{s}{|\\bar{x}|}"

  if (Math.abs(stats.media) <= Number.EPSILON) {
    return {
      title,
      generalLatex: general,
      substitutedLatex:
        "\\bar{x} = 0 \\Rightarrow \\mathrm{CV}_\\sigma\\ \\text{y}\\ \\mathrm{CV}_s\\ \\text{no se definen.}",
      explanation:
        "El coeficiente de variación compara la dispersión con la magnitud de la media.",
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
        "El coeficiente de variación expresa la dispersión en términos relativos respecto de la media.",
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
      "El coeficiente de variación expresa la dispersión en términos relativos respecto de la media.",
  }
}

function continuousFractileFormulaProps(
  rows: readonly GroupedContinuousFrequencyRow[],
  probability: number | null
): StatFormulaDialogProps | null {
  if (probability === null) {
    return null
  }

  const resolution = resolveGroupedContinuousFractile(rows, probability)
  if (!resolution) {
    return null
  }

  const { row } = resolution

  return {
    title: `Fractil del ${fmtNumber(probability * 100, 2)}%`,
    generalLatex:
      "X_{y}=L_{inf_x}+A_x\\left[\\dfrac{(n\\cdot y)-F_{a(x-1)}}{f_{ax}}\\right]",
    substitutedLatex: alignedLatex([
      `y = ${latexNum(probability, 4)}\\Rightarrow X_y = X_{${latexNum(probability, 4)}}`,
      `X_{${latexNum(probability, 4)}}\\ \\text{se encuentra en}\\ I_${row.item} = ${latexInterval(row)}`,
      `X_{${latexNum(probability, 4)}} = ${latexNum(row.lowerLimit)} + ${latexNum(row.amplitude)}\\left[\\dfrac{(${resolution.totalFrequency}\\cdot${latexNum(probability, 4)})-${latexNum(resolution.previousAbsoluteCumulativeFrequency, 4)}}{${row.absoluteFrequency}}\\right]`,
      `X_{${latexNum(probability, 4)}} = ${latexNum(row.lowerLimit)} + ${latexNum(row.amplitude)}\\left[\\dfrac{${latexNum(resolution.targetPosition, 4)}-${latexNum(resolution.previousAbsoluteCumulativeFrequency, 4)}}{${row.absoluteFrequency}}\\right] = ${latexNum(resolution.value, 4)}`,
    ]),
    explanation:
      "Se ubica el intervalo cuyo acumulado contiene a pn y luego se interpola linealmente dentro de ese tramo.",
  }
}

function continuousGuaranteedFractileFormulaProps(
  rows: readonly GroupedContinuousFrequencyRow[],
  guaranteedProbability: number | null
): StatFormulaDialogProps | null {
  if (guaranteedProbability === null) {
    return null
  }

  const leftProbability = 1 - guaranteedProbability
  if (leftProbability <= Number.EPSILON || leftProbability > 1) {
    return null
  }

  const resolution = resolveGroupedContinuousFractile(rows, leftProbability)
  if (!resolution) {
    return null
  }

  const { row } = resolution

  return {
    title: `Rendimiento garantizado para el ${fmtNumber(guaranteedProbability * 100, 2)}%`,
    generalLatex: "P(X\\geq x_g)=g \\Rightarrow x_g = X_{1-g}",
    substitutedLatex: alignedLatex([
      `g = ${latexNum(guaranteedProbability, 4)}`,
      `F(x_g) = 1 - g = 1 - ${latexNum(guaranteedProbability, 4)} = ${latexNum(leftProbability, 4)}`,
      `x_g = X_{${latexNum(leftProbability, 4)}}`,
      `x_g\\ \\text{se encuentra en}\\ I_${row.item} = ${latexInterval(row)}`,
      `x_g = ${latexNum(row.lowerLimit)} + ${latexNum(row.amplitude)}\\left[\\dfrac{(${resolution.totalFrequency}\\cdot${latexNum(leftProbability, 4)})-${latexNum(resolution.previousAbsoluteCumulativeFrequency, 4)}}{${row.absoluteFrequency}}\\right]`,
      `x_g = ${latexNum(row.lowerLimit)} + ${latexNum(row.amplitude)}\\left[\\dfrac{${latexNum(resolution.targetPosition, 4)}-${latexNum(resolution.previousAbsoluteCumulativeFrequency, 4)}}{${row.absoluteFrequency}}\\right] = ${latexNum(resolution.value, 4)}`,
    ]),
    explanation:
      "El valor garantizado para g se obtiene buscando el fractil complementario 1-g, porque ese porcentaje queda acumulado a la izquierda.",
  }
}

function continuousInverseFractileFormulaProps(
  rows: readonly GroupedContinuousFrequencyRow[],
  value: number | null
): StatFormulaDialogProps | null {
  if (value === null) {
    return null
  }

  const resolution = resolveGroupedContinuousInverseFractile(rows, value)
  if (!resolution) {
    return null
  }

  const { row } = resolution

  return {
    title: `Porcentaje acumulado hasta ${fmtNumber(value)}`,
    generalLatex:
      "F(x)=\\dfrac{1}{n}\\left[\\left(\\dfrac{x-L_{inf_x}}{A_x}\\cdot f_{ax}\\right)+F_{a(x-1)}\\right]",
    substitutedLatex: alignedLatex([
      `${latexNum(value, 4)}\\ \\text{se encuentra en}\\ I_${row.item} = ${latexInterval(row)}`,
      `F(${latexNum(value, 4)}) = \\dfrac{1}{${resolution.totalFrequency}}\\left[\\left(\\dfrac{${latexNum(value, 4)}-${latexNum(row.lowerLimit, 4)}}{${latexNum(row.amplitude, 4)}}\\cdot ${row.absoluteFrequency}\\right)+${latexNum(resolution.previousAbsoluteCumulativeFrequency, 4)}\\right]`,
      `F(${latexNum(value, 4)}) = \\dfrac{1}{${resolution.totalFrequency}}\\left[${latexNum(((value - row.lowerLimit) / row.amplitude) * row.absoluteFrequency, 4)}+${latexNum(resolution.previousAbsoluteCumulativeFrequency, 4)}\\right] = ${latexNum(resolution.probability, 4)}`,
      `F(${latexNum(value, 4)}) = ${latexNum(resolution.probability * 100, 2)}\\%`,
    ]),
    explanation:
      "Se interpola la posición del valor dentro de su intervalo y luego se divide por n para obtener el porcentaje acumulado a la izquierda.",
  }
}

function resolveCumulativeProbabilityAtValue(
  rows: readonly GroupedContinuousFrequencyRow[],
  value: number | null
) {
  if (value === null || rows.length === 0) {
    return null
  }

  const firstRow = rows[0]
  const lastRow = rows[rows.length - 1]
  if (!firstRow || !lastRow) {
    return null
  }

  if (value <= firstRow.lowerLimit) {
    return { probability: 0, value, kind: "below-min" as const }
  }

  if (value >= lastRow.upperLimit) {
    return { probability: 1, value, kind: "above-max" as const }
  }

  const resolution = resolveGroupedContinuousInverseFractile(rows, value)
  if (!resolution) {
    return null
  }

  return { ...resolution, kind: "inside" as const }
}

function resolveProbabilityInterval(
  rows: readonly GroupedContinuousFrequencyRow[],
  x: number | null,
  y: number | null
) {
  if (x === null || y === null) {
    return null
  }

  const lower = Math.min(x, y)
  const upper = Math.max(x, y)
  const lowerResolution = resolveCumulativeProbabilityAtValue(rows, lower)
  const upperResolution = resolveCumulativeProbabilityAtValue(rows, upper)

  if (!lowerResolution || !upperResolution) {
    return null
  }

  const belowLower = lowerResolution.probability
  const belowUpper = upperResolution.probability
  const aboveLower = 1 - belowLower
  const aboveUpper = 1 - belowUpper
  const between = Math.max(0, belowUpper - belowLower)

  return {
    lower,
    upper,
    lowerResolution,
    upperResolution,
    belowLower,
    belowUpper,
    aboveLower,
    aboveUpper,
    between,
  }
}

function continuousAboveValueFormulaProps(
  rows: readonly GroupedContinuousFrequencyRow[],
  value: number | null
): StatFormulaDialogProps | null {
  const resolution = resolveCumulativeProbabilityAtValue(rows, value)
  if (!resolution) {
    return null
  }

  if (resolution.kind !== "inside") {
    return {
      title: `Porcentaje por encima de ${fmtNumber(value ?? 0)}`,
      generalLatex: "P(X>x)=1-F(x)",
      substitutedLatex:
        resolution.kind === "below-min"
          ? `P(X>${latexNum(value ?? 0, 4)}) = 1 - 0 = 1`
          : `P(X>${latexNum(value ?? 0, 4)}) = 1 - 1 = 0`,
      explanation:
        "Cuando el valor queda fuera del rango observado, el porcentaje por encima se resuelve directamente con los extremos de la distribución.",
    }
  }

  return {
    title: `Porcentaje por encima de ${fmtNumber(value ?? 0)}`,
    generalLatex: "P(X>x)=1-F(x)",
    substitutedLatex: alignedLatex([
      `F(${latexNum(value ?? 0, 4)}) = ${latexNum(resolution.probability, 4)}`,
      `P(X>${latexNum(value ?? 0, 4)}) = 1 - ${latexNum(resolution.probability, 4)} = ${latexNum(1 - resolution.probability, 4)}`,
      `P(X>${latexNum(value ?? 0, 4)}) = ${latexNum((1 - resolution.probability) * 100, 2)}\\%`,
    ]),
    explanation:
      "El porcentaje a la derecha de un valor se obtiene como el complemento del porcentaje acumulado a la izquierda.",
  }
}

function continuousBetweenValuesFormulaProps(
  rows: readonly GroupedContinuousFrequencyRow[],
  x: number | null,
  y: number | null
): StatFormulaDialogProps | null {
  const interval = resolveProbabilityInterval(rows, x, y)
  if (!interval) {
    return null
  }

  return {
    title: `Porcentaje entre ${fmtNumber(interval.lower)} y ${fmtNumber(interval.upper)}`,
    generalLatex: "P(x<X<y)=F(y)-F(x)",
    substitutedLatex: alignedLatex([
      `F(${latexNum(interval.lower, 4)}) = ${latexNum(interval.belowLower, 4)},\\quad F(${latexNum(interval.upper, 4)}) = ${latexNum(interval.belowUpper, 4)}`,
      `P(${latexNum(interval.lower, 4)}<X<${latexNum(interval.upper, 4)}) = ${latexNum(interval.belowUpper, 4)} - ${latexNum(interval.belowLower, 4)} = ${latexNum(interval.between, 4)}`,
      `P(${latexNum(interval.lower, 4)}<X<${latexNum(interval.upper, 4)}) = ${latexNum(interval.between * 100, 2)}\\%`,
    ]),
    explanation:
      "El porcentaje comprendido entre dos valores se obtiene restando las acumuladas izquierdas evaluadas en el extremo superior y en el extremo inferior.",
  }
}

function conditionalFormulaProps(
  rows: readonly GroupedContinuousFrequencyRow[],
  x: number | null,
  y: number | null,
  variant:
    | "belowLowerGivenBelowUpper"
    | "aboveLowerGivenBelowUpper"
    | "belowUpperGivenAboveLower"
    | "aboveUpperGivenAboveLower"
): StatFormulaDialogProps | null {
  const interval = resolveProbabilityInterval(rows, x, y)
  if (!interval) {
    return null
  }

  const config = {
    belowLowerGivenBelowUpper: {
      title: `Porcentaje por debajo de ${fmtNumber(interval.lower)} dado que está por debajo de ${fmtNumber(interval.upper)}`,
      generalLatex:
        "P(X\\leq x\\mid X\\leq y)=\\dfrac{P(X\\leq x)}{P(X\\leq y)}",
      numerator: interval.belowLower,
      denominator: interval.belowUpper,
      numeratorLatex: `P(X\\leq ${latexNum(interval.lower, 4)})`,
      denominatorLatex: `P(X\\leq ${latexNum(interval.upper, 4)})`,
      resultLatex: `P(X\\leq ${latexNum(interval.lower, 4)}\\mid X\\leq ${latexNum(interval.upper, 4)})`,
      explanation:
        "Dentro de los casos que están por debajo del valor superior, se toma la proporción que también queda por debajo del valor inferior.",
    },
    aboveLowerGivenBelowUpper: {
      title: `Porcentaje por encima de ${fmtNumber(interval.lower)} dado que está por debajo de ${fmtNumber(interval.upper)}`,
      generalLatex:
        "P(X\\geq x\\mid X\\leq y)=\\dfrac{P(x\\leq X\\leq y)}{P(X\\leq y)}",
      numerator: interval.between,
      denominator: interval.belowUpper,
      numeratorLatex: `P(${latexNum(interval.lower, 4)}\\leq X\\leq ${latexNum(interval.upper, 4)})`,
      denominatorLatex: `P(X\\leq ${latexNum(interval.upper, 4)})`,
      resultLatex: `P(X\\geq ${latexNum(interval.lower, 4)}\\mid X\\leq ${latexNum(interval.upper, 4)})`,
      explanation:
        "Dentro de los casos que están por debajo del valor superior, se toma la parte que queda desde el valor inferior hacia arriba.",
    },
    belowUpperGivenAboveLower: {
      title: `Porcentaje por debajo de ${fmtNumber(interval.upper)} dado que está por encima de ${fmtNumber(interval.lower)}`,
      generalLatex:
        "P(X\\leq y\\mid X\\geq x)=\\dfrac{P(x\\leq X\\leq y)}{P(X\\geq x)}",
      numerator: interval.between,
      denominator: interval.aboveLower,
      numeratorLatex: `P(${latexNum(interval.lower, 4)}\\leq X\\leq ${latexNum(interval.upper, 4)})`,
      denominatorLatex: `P(X\\geq ${latexNum(interval.lower, 4)})`,
      resultLatex: `P(X\\leq ${latexNum(interval.upper, 4)}\\mid X\\geq ${latexNum(interval.lower, 4)})`,
      explanation:
        "Dentro de los casos que están por encima del valor inferior, se toma la parte que todavía queda por debajo del valor superior.",
    },
    aboveUpperGivenAboveLower: {
      title: `Porcentaje por encima de ${fmtNumber(interval.upper)} dado que está por encima de ${fmtNumber(interval.lower)}`,
      generalLatex:
        "P(X\\geq y\\mid X\\geq x)=\\dfrac{P(X\\geq y)}{P(X\\geq x)}",
      numerator: interval.aboveUpper,
      denominator: interval.aboveLower,
      numeratorLatex: `P(X\\geq ${latexNum(interval.upper, 4)})`,
      denominatorLatex: `P(X\\geq ${latexNum(interval.lower, 4)})`,
      resultLatex: `P(X\\geq ${latexNum(interval.upper, 4)}\\mid X\\geq ${latexNum(interval.lower, 4)})`,
      explanation:
        "Dentro de los casos que están por encima del valor inferior, se toma la parte que además queda por encima del valor superior.",
    },
  }[variant]

  const numerator = config.numerator
  const denominator = config.denominator

  if (denominator <= Number.EPSILON) {
    return {
      title: config.title,
      generalLatex: config.generalLatex,
      substitutedLatex:
        `${config.denominatorLatex} = 0 \\Rightarrow ${config.resultLatex}\\ \\text{no se define.}`,
      explanation:
        "La probabilidad condicional requiere que el evento condicionante tenga probabilidad positiva.",
    }
  }

  return {
    title: config.title,
    generalLatex: config.generalLatex,
    substitutedLatex: alignedLatex([
      `${config.numeratorLatex} = ${latexNum(numerator, 4)}`,
      `${config.denominatorLatex} = ${latexNum(denominator, 4)}`,
      `${config.resultLatex} = \\dfrac{${latexNum(numerator, 4)}}{${latexNum(denominator, 4)}} = ${latexNum(numerator / denominator, 4)}`,
      `${config.resultLatex} = ${latexNum((numerator / denominator) * 100, 2)}\\%`,
    ]),
    explanation: config.explanation,
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

function VariablesContinuasPage() {
  const [rows, setRows] = useState<EditableContinuousRow[]>([newEditableRow()])
  const [fractilePercent, setFractilePercent] = useState("50")
  const [guaranteedPercent, setGuaranteedPercent] = useState("")
  const [fractileValue, setFractileValue] = useState("")
  const [fractileUpperValue, setFractileUpperValue] = useState("")

  const removeRow = useCallback((rowId: string) => {
    setRows((previousRows) => {
      const nextRows = previousRows.filter((row) => row.id !== rowId)
      return nextRows.length > 0 ? nextRows : [newEditableRow()]
    })
  }, [])

  const updateRow = useCallback((
    rowId: string,
    field: keyof Omit<EditableContinuousRow, "id">,
    value: string
  ) => {
    setRows((previousRows) =>
      previousRows.map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row
      )
    )
  }, [])

  const derived = useMemo(() => buildDerivedContinuousTableState(rows), [rows])
  const parsedFractilePercent = parseFractilePercent(fractilePercent)
  const parsedGuaranteedPercent = parseFractilePercent(guaranteedPercent)
  const parsedFractileValue = parseNumericToken(fractileValue)
  const parsedFractileUpperValue = parseNumericToken(fractileUpperValue)
  const fractileFromPercent =
    derived.stats && parsedFractilePercent !== null
      ? resolveGroupedContinuousFractile(
        derived.stats.rows,
        parsedFractilePercent,
      )
      : null
  const guaranteedLeftProbability =
    parsedGuaranteedPercent === null ? null : 1 - parsedGuaranteedPercent
  const guaranteedFractile =
    derived.stats &&
      guaranteedLeftProbability !== null &&
      guaranteedLeftProbability > Number.EPSILON
      ? resolveGroupedContinuousFractile(
        derived.stats.rows,
        guaranteedLeftProbability,
      )
      : null
  const fractileFromValue =
    derived.stats && parsedFractileValue !== null
      ? resolveCumulativeProbabilityAtValue(
        derived.stats.rows,
        parsedFractileValue,
      )
      : null
  const probabilityInterval = derived.stats
    ? resolveProbabilityInterval(
      derived.stats.rows,
      parsedFractileValue,
      parsedFractileUpperValue,
    )
    : null
  const orderedBetweenValues = probabilityInterval
    ? {
      lower: probabilityInterval.lower,
      upper: probabilityInterval.upper,
    }
    : null
  const betweenProbability = probabilityInterval?.between ?? null
  const conditionalBelowLowerGivenBelowUpper =
    probabilityInterval && probabilityInterval.belowUpper > Number.EPSILON
      ? probabilityInterval.belowLower / probabilityInterval.belowUpper
      : null
  const conditionalAboveLowerGivenBelowUpper =
    probabilityInterval && probabilityInterval.belowUpper > Number.EPSILON
      ? probabilityInterval.between / probabilityInterval.belowUpper
      : null
  const conditionalBelowUpperGivenAboveLower =
    probabilityInterval && probabilityInterval.aboveLower > Number.EPSILON
      ? probabilityInterval.between / probabilityInterval.aboveLower
      : null
  const conditionalAboveUpperGivenAboveLower =
    probabilityInterval && probabilityInterval.aboveLower > Number.EPSILON
      ? probabilityInterval.aboveUpper / probabilityInterval.aboveLower
      : null
  const fractileFromPercentFormula = derived.stats
    ? continuousFractileFormulaProps(derived.stats.rows, parsedFractilePercent)
    : null
  const guaranteedFractileFormula = derived.stats
    ? continuousGuaranteedFractileFormulaProps(
      derived.stats.rows,
      parsedGuaranteedPercent,
    )
    : null
  const fractileFromValueFormula = derived.stats
    ? continuousInverseFractileFormulaProps(derived.stats.rows, parsedFractileValue)
    : null
  const fractileAboveValueFormula = derived.stats
    ? continuousAboveValueFormulaProps(derived.stats.rows, parsedFractileValue)
    : null
  const fractileBetweenValuesFormula = derived.stats
    ? continuousBetweenValuesFormulaProps(
      derived.stats.rows,
      parsedFractileValue,
      parsedFractileUpperValue,
    )
    : null
  const conditionalBelowLowerGivenBelowUpperFormula = derived.stats
    ? conditionalFormulaProps(
      derived.stats.rows,
      parsedFractileValue,
      parsedFractileUpperValue,
      "belowLowerGivenBelowUpper",
    )
    : null
  const conditionalAboveLowerGivenBelowUpperFormula = derived.stats
    ? conditionalFormulaProps(
      derived.stats.rows,
      parsedFractileValue,
      parsedFractileUpperValue,
      "aboveLowerGivenBelowUpper",
    )
    : null
  const conditionalBelowUpperGivenAboveLowerFormula = derived.stats
    ? conditionalFormulaProps(
      derived.stats.rows,
      parsedFractileValue,
      parsedFractileUpperValue,
      "belowUpperGivenAboveLower",
    )
    : null
  const conditionalAboveUpperGivenAboveLowerFormula = derived.stats
    ? conditionalFormulaProps(
      derived.stats.rows,
      parsedFractileValue,
      parsedFractileUpperValue,
      "aboveUpperGivenAboveLower",
    )
    : null

  const columns = useMemo<ColumnDef<EditableContinuousComputedRow>[]>(
    () => {
      return [
        {
          accessorKey: "item",
          header: "ID",
          cell: ({ row }) => (
            <span className="font-mono tabular-nums">{row.original.item}</span>
          ),
        },
        {
          id: "lowerLimit",
          header: () => <MathHeader label="Lím. inf." math="L_{i_{inf}}" />,
          cell: ({ row }) => (
            <Input
              inputMode="decimal"
              placeholder="Ej. 40"
              className="h-7 min-w-0 px-1.5 text-[11px] md:text-xs"
              value={row.original.lowerLimit}
              onChange={(event) =>
                updateRow(row.original.id, "lowerLimit", event.currentTarget.value)
              }
            />
          ),
        },
        {
          id: "upperLimit",
          header: () => <MathHeader label="Lím sup." math="L_{i_{sup}}" />,
          cell: ({ row }) => (
            <Input
              inputMode="decimal"
              placeholder="Ej. 50"
              className="h-7 min-w-0 px-1.5 text-[11px] md:text-xs"
              value={row.original.upperLimit}
              onChange={(event) =>
                updateRow(row.original.id, "upperLimit", event.currentTarget.value)
              }
            />
          ),
        },
        {
          id: "absoluteFrequency",
          header: () => <MathHeader label="Frec. abs." math="f_{ai}" />,
          cell: ({ row }) => (
            <Input
              inputMode="decimal"
              placeholder="Ej. 39"
              className="h-7 min-w-0 px-1.5 text-[11px] md:text-xs"
              value={row.original.frequency}
              onChange={(event) =>
                updateRow(row.original.id, "frequency", event.currentTarget.value)
              }
            />
          ),
          footer: ({ table }) =>
            (table.options.meta as ContinuousTableMeta | undefined)
              ?.totalFrequency === null ||
            (table.options.meta as ContinuousTableMeta | undefined)
              ?.totalFrequency === undefined ? null : (
              <InlineMath
                math={`\\sum f_{ai} = n = ${(table.options.meta as ContinuousTableMeta).totalFrequency}`}
              />
            ),
        },
        {
          id: "amplitude",
          header: () => <MathHeader label="Amp." math="A_i" />,
          cell: ({ row }) => (
            <ComputedCell value={row.original.computed?.amplitude ?? null} />
          ),
        },
        {
          id: "classMark",
          header: () => <MathHeader label="" math="C_i" />,
          cell: ({ row }) => (
            <ComputedCell value={row.original.computed?.classMark ?? null} />
          ),
        },
        {
          id: "classMarkByAbsoluteFrequency",
          header: () => <MathHeader label="" math="C_i \cdot f_{ai}" />,
          cell: ({ row }) => {
            const computed = row.original.computed
            const value = computed
              ? computed.classMark * computed.absoluteFrequency
              : null

            return <ComputedCell value={value} />
          },
        },
        {
          id: "squaredMeanDeviation",
          header: () => (
            <MathHeader label="" math="\left(C_i-\bar{x}\right)^2" />
          ),
          cell: ({ row, table }) => {
            const computed = row.original.computed
            const media = (table.options.meta as ContinuousTableMeta | undefined)
              ?.media ?? null
            const value =
              computed && media !== null ? (computed.classMark - media) ** 2 : null

            return <ComputedCell value={value} />
          },
        },
        {
          id: "weightedSquaredMeanDeviation",
          header: () => (
            <MathHeader
              label=""
              math="f_{ai} \cdot \left(C_i-\bar{x}\right)^2"
              mathClassName="whitespace-nowrap"
            />
          ),
          cell: ({ row, table }) => {
            const computed = row.original.computed
            const media = (table.options.meta as ContinuousTableMeta | undefined)
              ?.media ?? null
            const value =
              computed && media !== null
                ? computed.absoluteFrequency * (computed.classMark - media) ** 2
                : null

            return <ComputedCell value={value} />
          },
        },
        {
          id: "relativeFrequency",
          header: () => (
            <MathHeader
              label="Frec. rel."
              math={"f_i = \\frac{f_{ai}}{n}"}
            />
          ),
          cell: ({ row }) => (
            <ComputedCell
              value={row.original.computed?.relativeFrequency ?? null}
              formatter={fmtRelative}
            />
          ),
          footer: ({ table }) =>
            (table.options.meta as ContinuousTableMeta | undefined)
              ?.totalFrequency === null ||
            (table.options.meta as ContinuousTableMeta | undefined)
              ?.totalFrequency === undefined ? null : (
              <InlineMath math={"\\sum f_i = 1"} />
            ),
        },
        {
          id: "leftAbsoluteCumulativeFrequency",
          header: () => (
            <MathHeader
              label="Frecuencia acu. abs. izquierda"
              math="F_{ai}"
            />
          ),
          cell: ({ row }) => (
            <ComputedCell
              value={row.original.computed?.leftAbsoluteCumulativeFrequency ?? null}
            />
          ),
        },
        {
          id: "leftRelativeCumulativeFrequency",
          header: () => (
            <MathHeader
              label="Frecuencia acu. rel. izquierda"
              math="F_i"
            />
          ),
          cell: ({ row }) => (
            <ComputedCell
              value={row.original.computed?.leftRelativeCumulativeFrequency ?? null}
              formatter={fmtRelative}
            />
          ),
        },
        {
          id: "rightAbsoluteCumulativeFrequency",
          header: () => (
            <MathHeader
              label="Frecuencia acu. abs. derecha"
              math="G_{ai}"
            />
          ),
          cell: ({ row }) => (
            <ComputedCell
              value={row.original.computed?.rightAbsoluteCumulativeFrequency ?? null}
            />
          ),
        },
        {
          id: "rightRelativeCumulativeFrequency",
          header: () => (
            <MathHeader
              label="Frecuencia acu. rel. derecha"
              math="G_i"
            />
          ),
          cell: ({ row }) => (
            <ComputedCell
              value={row.original.computed?.rightRelativeCumulativeFrequency ?? null}
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
      ]
    },
    [removeRow, updateRow]
  )

  const table = useReactTable({
    data: derived.rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    meta: {
      totalFrequency: derived.totalFrequency,
      media: derived.stats?.media ?? null,
    },
  })

  return (
    <div className="flex max-w-7xl min-w-0 flex-col gap-6 text-sm leading-relaxed">
      <div>
        <h1 className="text-base font-medium">Variables continuas</h1>
        <p className="mt-1 text-muted-foreground">
          Ingresá los intervalos de clase y su frecuencia absoluta. La tabla
          deriva automáticamente la marca de clase, las frecuencias acumuladas y
          los estadísticos principales del apunte, incluidos desvío medio,
          rango y fractiles.
        </p>
      </div>

      <div className="rounded-md border border-border px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Cargá los intervalos de menor a mayor y sin superposición. La media y
          la dispersión se calculan usando la marca de clase, y la mediana se
          obtiene por interpolación lineal dentro del intervalo mediano.
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

      <div className="min-w-0 max-w-full overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[1480px] border-collapse text-xs sm:text-sm">
          <thead className="bg-muted/40">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`px-1 py-1 text-left text-[10px] font-medium text-muted-foreground sm:px-1.5 sm:py-1.5 ${getContinuousTableColumnClassName(header.column.id)}`.trim()}
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
                key={row.original.id}
                className="border-b border-border last:border-b-0"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={`px-1 py-1 align-middle sm:px-1.5 sm:py-1.5 ${getContinuousTableColumnClassName(cell.column.id)}`.trim()}
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
                    className={`px-1 py-1 text-[10px] font-medium text-muted-foreground sm:px-1.5 sm:py-1.5 ${getContinuousTableColumnClassName(header.column.id)}`.trim()}
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
          <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Resultados (n = {derived.stats.n})
          </h2>
          <div>
            <StatRow
              label="Media"
              value={fmtNumber(derived.stats.media)}
              formula={continuousStatFormulaProps(
                "media",
                "Media",
                derived.stats
              )}
            />
            <StatRow
              label="Mediana"
              value={fmtNumber(derived.stats.mediana)}
              hint={
                <>
                  Se ubica el intervalo donde la acumulada alcanza{" "}
                  <InlineMath math="n/2" /> y luego se interpola linealmente en
                  ese tramo.
                </>
              }
              formula={continuousStatFormulaProps(
                "mediana",
                "Mediana",
                derived.stats
              )}
            />
            <StatRow
              label="Intervalo modal"
              value={formatModalIntervals(derived.stats)}
              hint={
                <>
                  Es el intervalo con mayor <InlineMath math="f_{ai}" />.
                </>
              }
              formula={continuousStatFormulaProps(
                "intervaloModal",
                "Intervalo modal",
                derived.stats
              )}
            />
            <StatRow
              label="Desvío medio"
              value={fmtNumber(derived.stats.desvioMedio)}
              formula={continuousStatFormulaProps(
                "desvioMedio",
                "Desvío medio",
                derived.stats
              )}
            />
            <StatRow
              label="Rango"
              value={fmtNumber(derived.stats.rango)}
              formula={continuousStatFormulaProps(
                "rango",
                "Rango",
                derived.stats
              )}
            />
            <StatRow
              label="Varianza"
              value={fmtNumber(derived.stats.varianza)}
              formula={continuousStatFormulaProps(
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
              formula={continuousStatFormulaProps(
                "cuasiVarianza",
                "Cuasi-varianza muestral",
                derived.stats
              )}
            />
            <StatRow
              label="Desvío estándar"
              value={fmtNumber(derived.stats.desvioEstandar)}
              formula={continuousStatFormulaProps(
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
              formula={continuousStatFormulaProps(
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
              formula={continuousStatFormulaProps(
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
              formula={continuousStatFormulaProps(
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
              formula={continuousStatFormulaProps(
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
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Fractil
          </h2>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="rounded-md bg-muted/20 px-3 py-3">
              <div>
                <h3 className="text-sm font-medium">Desde porcentaje</h3>
                <p className="text-xs text-muted-foreground">
                  Podés calcular tanto el porcentaje acumulado a la izquierda
                  como el rendimiento garantizado para un porcentaje dado de
                  establecimientos.
                </p>
              </div>
              <div className="mt-3 flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="w-full">
                    <label
                      htmlFor="continuous-fractile-percent"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Porcentaje acumulado a la izquierda
                    </label>
                    <Input
                      id="continuous-fractile-percent"
                      inputMode="decimal"
                      className="mt-1"
                      value={fractilePercent}
                      onChange={(event) =>
                        setFractilePercent(event.currentTarget.value)
                      }
                      placeholder="Ej. 4,5"
                    />
                  </div>
                  <div className="w-full">
                    <label
                      htmlFor="continuous-guaranteed-percent"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Porcentaje garantizado a la derecha
                    </label>
                    <Input
                      id="continuous-guaranteed-percent"
                      inputMode="decimal"
                      className="mt-1"
                      value={guaranteedPercent}
                      onChange={(event) =>
                        setGuaranteedPercent(event.currentTarget.value)
                      }
                      placeholder="Ej. 95,5"
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="min-w-0 rounded-md bg-background px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-xs text-muted-foreground">
                        {parsedFractilePercent === null
                          ? "Ingresá un porcentaje entre 0 y 100."
                          : `Fractil del ${fmtNumber(parsedFractilePercent * 100, 2)}%`}
                      </div>
                      {fractileFromPercentFormula ? (
                        <StatFormulaDialog {...fractileFromPercentFormula} />
                      ) : null}
                    </div>
                    <div className="font-mono text-sm tabular-nums">
                      {fmtOptionalNumber(fractileFromPercent?.value)}
                    </div>
                  </div>
                  <div className="min-w-0 rounded-md bg-background px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-xs text-muted-foreground">
                        {parsedGuaranteedPercent === null
                          ? "Ingresá un porcentaje entre 0 y 100."
                          : guaranteedLeftProbability !== null &&
                            guaranteedLeftProbability > Number.EPSILON
                            ? `Garantizado para el ${fmtNumber(parsedGuaranteedPercent * 100, 2)}% (acumulado izquierdo: ${fmtNumber(guaranteedLeftProbability * 100, 2)}%)`
                            : "El 100% garantizado implicaría 0% acumulado a la izquierda."}
                      </div>
                      {guaranteedFractileFormula ? (
                        <StatFormulaDialog {...guaranteedFractileFormula} />
                      ) : null}
                    </div>
                    <div className="font-mono text-sm tabular-nums">
                      {fmtOptionalNumber(guaranteedFractile?.value)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-md bg-muted/20 px-3 py-3">
              <div>
                <h3 className="text-sm font-medium">Desde valor</h3>
                <p className="text-xs text-muted-foreground">
                  Desde este mismo sector podés calcular qué porcentaje está por
                  debajo de X, por encima de X, entre X e Y y probabilidades
                  condicionales usando esos mismos cortes.
                </p>
              </div>
              <div className="mt-3 flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="w-full">
                    <label
                      htmlFor="continuous-fractile-value"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Valor X
                    </label>
                    <Input
                      id="continuous-fractile-value"
                      inputMode="decimal"
                      className="mt-1"
                      value={fractileValue}
                      onChange={(event) =>
                        setFractileValue(event.currentTarget.value)
                      }
                      placeholder="Ej. 51"
                    />
                  </div>
                  <div className="w-full">
                    <label
                      htmlFor="continuous-fractile-upper-value"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Valor Y
                    </label>
                    <Input
                      id="continuous-fractile-upper-value"
                      inputMode="decimal"
                      className="mt-1"
                      value={fractileUpperValue}
                      onChange={(event) =>
                        setFractileUpperValue(event.currentTarget.value)
                      }
                      placeholder="Ej. 63"
                    />
                  </div>
                </div>
                <div className="grid gap-3">
                  <div className="min-w-0 rounded-md bg-background px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-xs text-muted-foreground">
                        {parsedFractileValue === null
                          ? "Ingresá un valor X numérico."
                          : `Porcentaje de observaciones por debajo de ${fmtNumber(parsedFractileValue)}`}
                      </div>
                      {fractileFromValueFormula ? (
                        <StatFormulaDialog {...fractileFromValueFormula} />
                      ) : null}
                    </div>
                    <div className="font-mono text-sm tabular-nums">
                      {fractileFromValue === null
                        ? "—"
                        : `${fmtNumber(fractileFromValue.probability, 4)} (${fmtPercent(
                          fractileFromValue.probability,
                          2,
                        )})`}
                    </div>
                  </div>

                  <div className="min-w-0 rounded-md bg-background px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-xs text-muted-foreground">
                        {parsedFractileValue === null
                          ? "Ingresá un valor X numérico."
                          : `Porcentaje de observaciones por encima de ${fmtNumber(parsedFractileValue)}`}
                      </div>
                      {fractileAboveValueFormula ? (
                        <StatFormulaDialog {...fractileAboveValueFormula} />
                      ) : null}
                    </div>
                    <div className="font-mono text-sm tabular-nums">
                      {fractileFromValue === null
                        ? "—"
                        : `${fmtNumber(1 - fractileFromValue.probability, 4)} (${fmtPercent(
                          1 - fractileFromValue.probability,
                          2,
                        )})`}
                    </div>
                  </div>

                  <div className="min-w-0 rounded-md bg-background px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-xs text-muted-foreground">
                        {orderedBetweenValues === null
                          ? "Ingresá valores X e Y numéricos."
                          : `Porcentaje de observaciones entre ${fmtNumber(orderedBetweenValues.lower)} y ${fmtNumber(orderedBetweenValues.upper)}`}
                      </div>
                      {fractileBetweenValuesFormula ? (
                        <StatFormulaDialog {...fractileBetweenValuesFormula} />
                      ) : null}
                    </div>
                    <div className="font-mono text-sm tabular-nums">
                      {betweenProbability === null
                        ? "—"
                        : `${fmtNumber(betweenProbability, 4)} (${fmtPercent(
                          betweenProbability,
                          2,
                        )})`}
                    </div>
                  </div>

                  <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-3">
                    <div>
                      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Condicionales
                      </h4>

                    </div>
                    <div className="mt-3 grid gap-3">
                      <div className="min-w-0 rounded-md bg-background px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-xs text-muted-foreground">
                            {orderedBetweenValues === null
                              ? "Ingresá valores X e Y numéricos."
                              : `De las observaciones por debajo de ${fmtNumber(orderedBetweenValues.upper)}, qué porcentaje está por debajo de ${fmtNumber(orderedBetweenValues.lower)}`}
                          </div>
                          {conditionalBelowLowerGivenBelowUpperFormula ? (
                            <StatFormulaDialog
                              {...conditionalBelowLowerGivenBelowUpperFormula}
                            />
                          ) : null}
                        </div>
                        <div className="font-mono text-sm tabular-nums">
                          {orderedBetweenValues === null
                            ? "—"
                            : conditionalBelowLowerGivenBelowUpper === null
                              ? "—"
                              : `${fmtNumber(
                                conditionalBelowLowerGivenBelowUpper,
                                4,
                              )} (${fmtPercent(
                                conditionalBelowLowerGivenBelowUpper,
                                2,
                              )})`}
                        </div>
                      </div>

                      <div className="min-w-0 rounded-md bg-background px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-xs text-muted-foreground">
                            {orderedBetweenValues === null
                              ? "Ingresá valores X e Y numéricos."
                              : `De las observaciones por debajo de ${fmtNumber(orderedBetweenValues.upper)}, qué porcentaje está por encima de ${fmtNumber(orderedBetweenValues.lower)}`}
                          </div>
                          {conditionalAboveLowerGivenBelowUpperFormula ? (
                            <StatFormulaDialog
                              {...conditionalAboveLowerGivenBelowUpperFormula}
                            />
                          ) : null}
                        </div>
                        <div className="font-mono text-sm tabular-nums">
                          {orderedBetweenValues === null
                            ? "—"
                            : conditionalAboveLowerGivenBelowUpper === null
                              ? "—"
                              : `${fmtNumber(
                                conditionalAboveLowerGivenBelowUpper,
                                4,
                              )} (${fmtPercent(
                                conditionalAboveLowerGivenBelowUpper,
                                2,
                              )})`}
                        </div>
                      </div>

                      <div className="min-w-0 rounded-md bg-background px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-xs text-muted-foreground">
                            {orderedBetweenValues === null
                              ? "Ingresá valores X e Y numéricos."
                              : `De las observaciones por encima de ${fmtNumber(orderedBetweenValues.lower)}, qué porcentaje está por debajo de ${fmtNumber(orderedBetweenValues.upper)}`}
                          </div>
                          {conditionalBelowUpperGivenAboveLowerFormula ? (
                            <StatFormulaDialog
                              {...conditionalBelowUpperGivenAboveLowerFormula}
                            />
                          ) : null}
                        </div>
                        <div className="font-mono text-sm tabular-nums">
                          {orderedBetweenValues === null
                            ? "—"
                            : conditionalBelowUpperGivenAboveLower === null
                              ? "—"
                              : `${fmtNumber(
                                conditionalBelowUpperGivenAboveLower,
                                4,
                              )} (${fmtPercent(
                                conditionalBelowUpperGivenAboveLower,
                                2,
                              )})`}
                        </div>
                      </div>

                      <div className="min-w-0 rounded-md bg-background px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-xs text-muted-foreground">
                            {orderedBetweenValues === null
                              ? "Ingresá valores X e Y numéricos."
                              : `De las observaciones por encima de ${fmtNumber(orderedBetweenValues.lower)}, qué porcentaje está por encima de ${fmtNumber(orderedBetweenValues.upper)}`}
                          </div>
                          {conditionalAboveUpperGivenAboveLowerFormula ? (
                            <StatFormulaDialog
                              {...conditionalAboveUpperGivenAboveLowerFormula}
                            />
                          ) : null}
                        </div>
                        <div className="font-mono text-sm tabular-nums">
                          {orderedBetweenValues === null
                            ? "—"
                            : conditionalAboveUpperGivenAboveLower === null
                              ? "—"
                              : `${fmtNumber(
                                conditionalAboveUpperGivenAboveLower,
                                4,
                              )} (${fmtPercent(
                                conditionalAboveUpperGivenAboveLower,
                                2,
                              )})`}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
