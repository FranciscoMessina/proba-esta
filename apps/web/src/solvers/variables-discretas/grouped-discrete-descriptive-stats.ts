import {
  computeGroupedDiscreteFrequencyTable,
  type GroupedDiscreteFrequencyRow,
  type GroupedDiscreteFrequencyTable,
  type GroupedDiscreteInputRow,
} from "./grouped-discrete-frequency-table"

export type GroupedDiscreteDescriptiveStats = {
  n: number
  media: number
  mediana: number | readonly [number, number]
  moda: number[]
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
  rows: GroupedDiscreteFrequencyRow[]
  medianLeftPosition: number
  medianRightPosition: number
  medianLeftRow: GroupedDiscreteFrequencyRow
  medianRightRow: GroupedDiscreteFrequencyRow
}

export type GroupedDiscreteFractile = number | readonly [number, number]

function modes(rows: readonly GroupedDiscreteFrequencyRow[]): number[] {
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

  return rows
    .filter((row) => row.absoluteFrequency === maxFrequency)
    .map((row) => row.value)
}

function sumWeightedCenteredPowers(
  rows: readonly GroupedDiscreteFrequencyRow[],
  media: number,
  exponent: 2 | 3 | 4
): number {
  let sum = 0

  for (const row of rows) {
    const deviation = row.value - media
    sum += row.absoluteFrequency * deviation ** exponent
  }

  return sum
}

function sumWeightedAbsoluteDeviations(
  rows: readonly GroupedDiscreteFrequencyRow[],
  media: number,
): number {
  let sum = 0

  for (const row of rows) {
    sum += row.absoluteFrequency * Math.abs(row.value - media)
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
  rows: readonly GroupedDiscreteFrequencyRow[],
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
  rows: readonly GroupedDiscreteFrequencyRow[],
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

function findRowAtPosition(
  rows: readonly GroupedDiscreteFrequencyRow[],
  position: number
): GroupedDiscreteFrequencyRow | null {
  return (
    rows.find(
      (row) => row.leftAbsoluteCumulativeFrequency >= position
    ) ?? null
  )
}

export function computeGroupedDiscreteDescriptiveStatsFromFrequencyTable(
  table: GroupedDiscreteFrequencyTable
): GroupedDiscreteDescriptiveStats | { error: string } {
  if (table.rows.length === 0 || table.totalFrequency <= 0) {
    return { error: "Se requiere al menos una fila válida para calcular." }
  }

  const { rows, totalFrequency } = table
  const sumaProductos = rows.reduce(
    (total, row) => total + row.value * row.absoluteFrequency,
    0
  )
  const media = sumaProductos / totalFrequency

  const medianLeftPosition =
    totalFrequency % 2 === 0
      ? totalFrequency / 2
      : Math.floor(totalFrequency / 2) + 1
  const medianRightPosition =
    totalFrequency % 2 === 0
      ? medianLeftPosition + 1
      : medianLeftPosition

  const medianLeftRow = findRowAtPosition(rows, medianLeftPosition)
  const medianRightRow = findRowAtPosition(rows, medianRightPosition)

  if (!medianLeftRow || !medianRightRow) {
    return {
      error: "No se pudo ubicar la mediana con las frecuencias acumuladas.",
    }
  }

  const mediana =
    medianLeftRow.value === medianRightRow.value
      ? medianLeftRow.value
      : [medianLeftRow.value, medianRightRow.value] as const
  const moda = modes(rows)
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
    moda,
    desvioMedio: sumaDesviosAbsolutos / totalFrequency,
    rango: rows[rows.length - 1]!.value - rows[0]!.value,
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
    medianLeftPosition,
    medianRightPosition,
    medianLeftRow,
    medianRightRow,
  }
}

export function computeGroupedDiscreteFractile(
  rows: readonly GroupedDiscreteFrequencyRow[],
  probability: number,
): GroupedDiscreteFractile | null {
  if (rows.length === 0 || probability <= 0 || probability > 1) {
    return null
  }

  const totalFrequency = rows[rows.length - 1]?.leftAbsoluteCumulativeFrequency ?? 0
  if (totalFrequency <= 0) {
    return null
  }

  const target = probability * totalFrequency
  const resolvedRow = findRowAtPosition(rows, Math.max(1, Math.ceil(target)))
  if (!resolvedRow) {
    return null
  }

  if (Number.isInteger(target) && target >= 1 && target < totalFrequency) {
    const leftRow = findRowAtPosition(rows, target)
    const rightRow = findRowAtPosition(rows, target + 1)

    if (leftRow && rightRow && leftRow.value !== rightRow.value) {
      return [leftRow.value, rightRow.value] as const
    }
  }

  return resolvedRow.value
}

export function computeGroupedDiscreteDescriptiveStats(
  input: readonly GroupedDiscreteInputRow[]
): GroupedDiscreteDescriptiveStats | { error: string } {
  const table = computeGroupedDiscreteFrequencyTable(input)
  if ("error" in table) {
    return table
  }

  return computeGroupedDiscreteDescriptiveStatsFromFrequencyTable(table)
}
