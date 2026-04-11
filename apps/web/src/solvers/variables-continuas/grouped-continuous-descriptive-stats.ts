import {
  computeGroupedContinuousFrequencyTable,
  type GroupedContinuousFrequencyRow,
  type GroupedContinuousFrequencyTable,
  type GroupedContinuousInputRow,
} from "./grouped-continuous-frequency-table"

export type GroupedContinuousDescriptiveStats = {
  n: number
  media: number
  mediana: number
  modalRows: GroupedContinuousFrequencyRow[]
  desvioMedio: number
  rango: number
  varianza: number
  cuasiVarianza: number | null
  desvioEstandar: number
  cuasiDesvioEstandar: number | null
  coeficienteVariacionPoblacional: number | null
  coeficienteVariacionMuestral: number | null
  coeficienteAsimetria: number | null
  coeficienteCurtosis: number | null
  sumaProductos: number
  sumaDesviosAbsolutos: number
  sumaCuadradosDesvios: number
  sumaCubosDesvios: number | null
  sumaCuartosDesvios: number | null
  momentoCentral3: number | null
  momentoCentral4: number | null
  rows: GroupedContinuousFrequencyRow[]
  medianTargetPosition: number
  medianRow: GroupedContinuousFrequencyRow
  medianPreviousAbsoluteCumulativeFrequency: number
}

export type GroupedContinuousFractileResolution = {
  totalFrequency: number
  probability: number
  targetPosition: number
  row: GroupedContinuousFrequencyRow
  previousAbsoluteCumulativeFrequency: number
  value: number
}

export type GroupedContinuousInverseFractileResolution = {
  totalFrequency: number
  value: number
  probability: number
  absolutePosition: number
  row: GroupedContinuousFrequencyRow
  previousAbsoluteCumulativeFrequency: number
}

function modalIntervals(
  rows: readonly GroupedContinuousFrequencyRow[]
): GroupedContinuousFrequencyRow[] {
  if (rows.length === 0) {
    return []
  }

  const maxFrequency = Math.max(...rows.map((row) => row.absoluteFrequency))
  const allShareSameFrequency = rows.every(
    (row) => row.absoluteFrequency === maxFrequency
  )

  if (allShareSameFrequency && rows.length > 1) {
    return []
  }

  return rows.filter((row) => row.absoluteFrequency === maxFrequency)
}

function sumWeightedCenteredPowers(
  rows: readonly GroupedContinuousFrequencyRow[],
  media: number,
  exponent: 2 | 3 | 4
): number {
  let sum = 0

  for (const row of rows) {
    const deviation = row.classMark - media
    sum += row.absoluteFrequency * deviation ** exponent
  }

  return sum
}

function sumWeightedAbsoluteDeviations(
  rows: readonly GroupedContinuousFrequencyRow[],
  media: number,
): number {
  let sum = 0

  for (const row of rows) {
    sum += row.absoluteFrequency * Math.abs(row.classMark - media)
  }

  return sum
}

function calculatePopulationDispersion(
  ss: number,
  n: number
): { varianza: number; desvioEstandar: number } {
  const varianza = ss / n

  return {
    varianza,
    desvioEstandar: Math.sqrt(varianza),
  }
}

function calculateSampleDispersion(
  ss: number,
  n: number
): { cuasiVarianza: number | null; cuasiDesvioEstandar: number | null } {
  if (n < 2) {
    return {
      cuasiVarianza: null,
      cuasiDesvioEstandar: null,
    }
  }

  const cuasiVarianza = ss / (n - 1)

  return {
    cuasiVarianza,
    cuasiDesvioEstandar: Math.sqrt(cuasiVarianza),
  }
}

function calculateVariationCoefficients(
  media: number,
  desvioEstandar: number,
  cuasiDesvioEstandar: number | null
): {
  coeficienteVariacionPoblacional: number | null
  coeficienteVariacionMuestral: number | null
} {
  if (Math.abs(media) <= Number.EPSILON) {
    return {
      coeficienteVariacionPoblacional: null,
      coeficienteVariacionMuestral: null,
    }
  }

  return {
    coeficienteVariacionPoblacional: desvioEstandar / Math.abs(media),
    coeficienteVariacionMuestral:
      cuasiDesvioEstandar === null ? null : cuasiDesvioEstandar / Math.abs(media),
  }
}

function calculateSkewness(
  rows: readonly GroupedContinuousFrequencyRow[],
  n: number,
  media: number,
  desvioEstandar: number | null
): {
  coeficienteAsimetria: number | null
  sumaCubosDesvios: number | null
  momentoCentral3: number | null
} {
  if (
    desvioEstandar === null ||
    desvioEstandar <= Number.EPSILON
  ) {
    return {
      coeficienteAsimetria: null,
      sumaCubosDesvios: null,
      momentoCentral3: null,
    }
  }

  const sumaCubosDesvios = sumWeightedCenteredPowers(rows, media, 3)
  const momentoCentral3 = sumaCubosDesvios / n

  return {
    coeficienteAsimetria: momentoCentral3 / desvioEstandar ** 3,
    sumaCubosDesvios,
    momentoCentral3,
  }
}

function calculateKurtosis(
  rows: readonly GroupedContinuousFrequencyRow[],
  n: number,
  media: number,
  desvioEstandar: number | null
): {
  coeficienteCurtosis: number | null
  sumaCuartosDesvios: number | null
  momentoCentral4: number | null
} {
  if (
    desvioEstandar === null ||
    desvioEstandar <= Number.EPSILON
  ) {
    return {
      coeficienteCurtosis: null,
      sumaCuartosDesvios: null,
      momentoCentral4: null,
    }
  }

  const sumaCuartosDesvios = sumWeightedCenteredPowers(rows, media, 4)
  const momentoCentral4 = sumaCuartosDesvios / n

  return {
    coeficienteCurtosis: momentoCentral4 / desvioEstandar ** 4,
    sumaCuartosDesvios,
    momentoCentral4,
  }
}

function findMedianRow(
  rows: readonly GroupedContinuousFrequencyRow[],
  targetPosition: number
): GroupedContinuousFrequencyRow | null {
  return (
    rows.find(
      (row) => row.leftAbsoluteCumulativeFrequency >= targetPosition
    ) ?? null
  )
}

function findRowContainingValue(
  rows: readonly GroupedContinuousFrequencyRow[],
  value: number
): GroupedContinuousFrequencyRow | null {
  const lastRow = rows[rows.length - 1]
  if (!lastRow) {
    return null
  }

  if (Math.abs(value - lastRow.upperLimit) <= Number.EPSILON) {
    return lastRow
  }

  return (
    rows.find((row) => value >= row.lowerLimit && value < row.upperLimit) ?? null
  )
}

export function computeGroupedContinuousDescriptiveStatsFromFrequencyTable(
  table: GroupedContinuousFrequencyTable
): GroupedContinuousDescriptiveStats | { error: string } {
  if (table.rows.length === 0 || table.totalFrequency <= 0) {
    return { error: "Se requiere al menos una fila válida para calcular." }
  }

  const { rows, totalFrequency } = table
  const sumaProductos = rows.reduce(
    (total, row) => total + row.classMark * row.absoluteFrequency,
    0
  )
  const media = sumaProductos / totalFrequency
  const medianTargetPosition = totalFrequency / 2
  const medianRow = findMedianRow(rows, medianTargetPosition)

  if (!medianRow) {
    return {
      error: "No se pudo ubicar el intervalo mediano con las frecuencias acumuladas.",
    }
  }

  const medianPreviousAbsoluteCumulativeFrequency =
    medianRow.leftAbsoluteCumulativeFrequency - medianRow.absoluteFrequency
  const mediana =
    medianRow.lowerLimit +
    medianRow.amplitude *
      ((medianTargetPosition - medianPreviousAbsoluteCumulativeFrequency) /
        medianRow.absoluteFrequency)

  const modalRows = modalIntervals(rows)
  const sumaDesviosAbsolutos = sumWeightedAbsoluteDeviations(rows, media)
  const sumaCuadradosDesvios = sumWeightedCenteredPowers(rows, media, 2)
  const { varianza, desvioEstandar } = calculatePopulationDispersion(
    sumaCuadradosDesvios,
    totalFrequency
  )
  const { cuasiVarianza, cuasiDesvioEstandar } = calculateSampleDispersion(
    sumaCuadradosDesvios,
    totalFrequency
  )
  const {
    coeficienteVariacionPoblacional,
    coeficienteVariacionMuestral,
  } = calculateVariationCoefficients(media, desvioEstandar, cuasiDesvioEstandar)
  const { coeficienteAsimetria, sumaCubosDesvios, momentoCentral3 } =
    calculateSkewness(rows, totalFrequency, media, desvioEstandar)
  const { coeficienteCurtosis, sumaCuartosDesvios, momentoCentral4 } =
    calculateKurtosis(rows, totalFrequency, media, desvioEstandar)

  return {
    n: totalFrequency,
    media,
    mediana,
    modalRows,
    desvioMedio: sumaDesviosAbsolutos / totalFrequency,
    rango: rows[rows.length - 1]!.upperLimit - rows[0]!.lowerLimit,
    varianza,
    cuasiVarianza,
    desvioEstandar,
    cuasiDesvioEstandar,
    coeficienteVariacionPoblacional,
    coeficienteVariacionMuestral,
    coeficienteAsimetria,
    coeficienteCurtosis,
    sumaProductos,
    sumaDesviosAbsolutos,
    sumaCuadradosDesvios,
    sumaCubosDesvios,
    sumaCuartosDesvios,
    momentoCentral3,
    momentoCentral4,
    rows: [...rows],
    medianTargetPosition,
    medianRow,
    medianPreviousAbsoluteCumulativeFrequency,
  }
}

export function resolveGroupedContinuousFractile(
  rows: readonly GroupedContinuousFrequencyRow[],
  probability: number,
): GroupedContinuousFractileResolution | null {
  if (rows.length === 0 || probability <= 0 || probability > 1) {
    return null
  }

  const totalFrequency = rows[rows.length - 1]?.leftAbsoluteCumulativeFrequency ?? 0
  if (totalFrequency <= 0) {
    return null
  }

  const targetPosition = probability * totalFrequency
  const fractileRow = findMedianRow(rows, targetPosition)
  if (!fractileRow) {
    return null
  }

  const previousAbsoluteCumulativeFrequency =
    fractileRow.leftAbsoluteCumulativeFrequency - fractileRow.absoluteFrequency

  const value =
    fractileRow.lowerLimit +
    fractileRow.amplitude *
      ((targetPosition - previousAbsoluteCumulativeFrequency) /
        fractileRow.absoluteFrequency)

  return {
    totalFrequency,
    probability,
    targetPosition,
    row: fractileRow,
    previousAbsoluteCumulativeFrequency,
    value,
  }
}

export function computeGroupedContinuousFractile(
  rows: readonly GroupedContinuousFrequencyRow[],
  probability: number,
): number | null {
  return resolveGroupedContinuousFractile(rows, probability)?.value ?? null
}

export function resolveGroupedContinuousInverseFractile(
  rows: readonly GroupedContinuousFrequencyRow[],
  value: number,
): GroupedContinuousInverseFractileResolution | null {
  if (rows.length === 0 || !Number.isFinite(value)) {
    return null
  }

  const totalFrequency = rows[rows.length - 1]?.leftAbsoluteCumulativeFrequency ?? 0
  if (totalFrequency <= 0) {
    return null
  }

  const row = findRowContainingValue(rows, value)
  if (!row) {
    return null
  }

  const previousAbsoluteCumulativeFrequency =
    row.leftAbsoluteCumulativeFrequency - row.absoluteFrequency
  const intervalProgress =
    Math.abs(value - row.upperLimit) <= Number.EPSILON
      ? 1
      : (value - row.lowerLimit) / row.amplitude
  const absolutePosition =
    previousAbsoluteCumulativeFrequency + intervalProgress * row.absoluteFrequency

  return {
    totalFrequency,
    value,
    probability: absolutePosition / totalFrequency,
    absolutePosition,
    row,
    previousAbsoluteCumulativeFrequency,
  }
}

export function computeGroupedContinuousDescriptiveStats(
  input: readonly GroupedContinuousInputRow[]
): GroupedContinuousDescriptiveStats | { error: string } {
  const table = computeGroupedContinuousFrequencyTable(input)
  if ("error" in table) {
    return table
  }

  return computeGroupedContinuousDescriptiveStatsFromFrequencyTable(table)
}
