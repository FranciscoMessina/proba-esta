import * as stats from 'simple-statistics'

/**
 * Estadísticos descriptivos para variables discretas (datos sin agrupar).
 * Fórmulas alineadas con criterio poblacional vs. muestral (cuasi-) habituales en estadística.
 */

export type ParseDiscreteValuesResult =
  | { ok: true; values: number[] }
  | { ok: false; error: string }

export type DiscreteDescriptiveStats = {
  /** Tamaño muestral n */
  n: number
  /** Media aritmética x̄ */
  media: number
  /** Mediana */
  mediana: number | number[]
  /**
   * Valor(es) modal(es), ordenados ascendente.
   * Array vacío si no hay moda (todos los valores tienen la misma frecuencia máxima 1 cuando n > 1).
   */
  moda: number[]
  /** Desvío medio respecto de la media */
  desvioMedio: number
  /** Rango = valor máximo - valor mínimo */
  rango: number
  /** Varianza poblacional σ² = (1/n) Σ(xᵢ − μ)² */
  varianza: number
  /** Cuasi-varianza (varianza muestral) s² = (1/(n−1)) Σ(xᵢ − x̄)²; null si n < 2 */
  cuasiVarianza: number | null
  /** Desvío estándar poblacional σ */
  desvioEstandar: number
  /** Cuasi-desvío estándar s; null si n < 2 */
  cuasiDesvioEstandar: number | null
  /**
   * CV poblacional: σ / |x̄| (desvío estándar de la varianza poblacional).
   * Null si x̄ = 0.
   */
  coeficienteVariacionPoblacional: number | null
  /**
   * CV muestral: s / |x̄| (cuasi-desvío). Null si x̄ = 0 o n < 2.
   */
  coeficienteVariacionMuestral: number | null
  /**
   * Coeficiente de asimetría:
   * As = m₃ / σ³, con m₃ = (1/n) Σ(xᵢ − x̄)³ y σ = desvío estándar poblacional.
   * Null si σ = 0.
   */
  coeficienteAsimetria: number | null
  /**
   * Coeficiente de curtosis:
   * Ku = m₄ / σ⁴, con m₄ = (1/n) Σ(xᵢ − x̄)⁴ y σ = desvío estándar poblacional.
   * Null si σ = 0.
   */
  coeficienteCurtosis: number | null
  /** Σ xᵢ (para mostrar el cálculo de la media). */
  sumaValores: number
  /** Σ |xᵢ − x̄| (para mostrar el cálculo del desvío medio). */
  sumaDesviosAbsolutos: number
  /** Σ(xᵢ − x̄)² (suma de cuadrados respecto de la media). */
  sumaCuadradosDesvios: number
  /** Σ(xᵢ − x̄)³. Null si S no existe o S ≈ 0. */
  sumaCubosDesvios: number | null
  /** Σ(xᵢ − x̄)⁴. Null si S no existe o S ≈ 0. */
  sumaCuartosDesvios: number | null
  /** m₃ = (1/n) Σ(xᵢ − x̄)³. Null si S no existe o S ≈ 0. */
  momentoCentral3: number | null
  /** m₄ = (1/n) Σ(xᵢ − x̄)⁴. Null si S no existe o S ≈ 0. */
  momentoCentral4: number | null
}

const splitPattern = /[\s,;]+/

/**
 * Interpreta texto con números separados por espacios, comas o punto y coma.
 * Acepta coma decimal en el token (p. ej. "3,14" → 3.14).
 */
export function parseDiscreteValues(raw: string): ParseDiscreteValuesResult {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { ok: false, error: "Ingrese al menos un número." }
  }

  const parts = trimmed.split(splitPattern).map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) {
    return { ok: false, error: "Ingrese al menos un número." }
  }

  const values: number[] = []
  const invalid: string[] = []

  for (const part of parts) {
    const normalized = part.replace(",", ".")
    const n = Number(normalized)
    if (Number.isFinite(n)) {
      values.push(n)
    } else {
      invalid.push(part)
    }
  }

  if (invalid.length > 0) {
    return {
      ok: false,
      error: `Valores no numéricos: ${invalid.join(", ")}`,
    }
  }

  return { ok: true, values }
}

/**
 * Interpreta un único token (coma o punto como separador decimal).
 */
export function parseNumericToken(raw: string): number | null {
  const t = raw.trim()
  if (!t) {
    return null
  }
  const n = Number(t.replace(",", "."))
  return Number.isFinite(n) ? n : null
}

export type DiscreteFractile = number | readonly [number, number]

function mean(values: readonly number[]): number  {
  return stats.mean(values)
}

function median(sorted: readonly number[]): number | number[] {

  if (sorted.length % 2 === 0) {
    // Devolvemos los 2 valores centrales.
    return [sorted[sorted.length / 2 - 1]!, sorted[sorted.length / 2]!]
  }
  return stats.median(sorted)
}

function modes(values: readonly number[]): number[] {
  const freq = new Map<number, number>()
  for (const x of values) {
    freq.set(x, (freq.get(x) ?? 0) + 1)
  }

  let max = 0
  for (const c of freq.values()) {
    if (c > max) {
      max = c
    }
  }

  if (max === 1 && values.length > 1) {
    return []
  }

  const out: number[] = []
  for (const [x, c] of freq) {
    if (c === max) {
      out.push(x)
    }
  }
  out.sort((a, b) => a - b)
  return out
}

function sumSquaredDeviations(values: readonly number[], m: number): number {
  let ss = 0
  for (const x of values) {
    const d = x - m
    ss += d * d
  }
  return ss
}

function sumAbsoluteDeviations(values: readonly number[], media: number): number {
  let sum = 0
  for (const value of values) {
    sum += Math.abs(value - media)
  }
  return sum
}

function sumCenteredPowers(
  values: readonly number[],
  media: number,
  exponent: 3 | 4,
): number {
  let sum = 0
  for (const x of values) {
    const d = x - media
    sum += Math.pow(d, exponent)
  }
  return sum
}

function calculatePopulationDispersion(ss: number, n: number): {
  varianza: number
  desvioEstandar: number
} {
  const varianza = ss / n
  return {
    varianza,
    desvioEstandar: Math.sqrt(varianza),
  }
}

function calculateSampleDispersion(ss: number, n: number): {
  cuasiVarianza: number | null
  cuasiDesvioEstandar: number | null
} {
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
  cuasiDesvioEstandar: number | null,
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
  values: readonly number[],
  n: number,
  media: number,
  desvioEstandar: number | null,
): {
  coeficienteAsimetria: number | null
  sumaCubosDesvios: number | null
  momentoCentral3: number | null
} {
  if (desvioEstandar === null) {
    return {
      coeficienteAsimetria: null,
      sumaCubosDesvios: null,
      momentoCentral3: null,
    }
  }

  if (desvioEstandar <= Number.EPSILON) {
    return {
      coeficienteAsimetria: null,
      sumaCubosDesvios: null,
      momentoCentral3: null,
    }
  }

  const sumaCubosDesvios = sumCenteredPowers(values, media, 3)
  const momentoCentral3 = sumaCubosDesvios / n
  return {
    sumaCubosDesvios,
    momentoCentral3,
    coeficienteAsimetria: momentoCentral3 / (desvioEstandar ** 3),
  }
}

function calculateKurtosis(
  values: readonly number[],
  n: number,
  media: number,
  desvioEstandar: number | null,
): {
  coeficienteCurtosis: number | null
  sumaCuartosDesvios: number | null
  momentoCentral4: number | null
} {
  if (desvioEstandar === null || desvioEstandar <= Number.EPSILON) {
    return {
      coeficienteCurtosis: null,
      sumaCuartosDesvios: null,
      momentoCentral4: null,
    }
  }

  const sumaCuartosDesvios = sumCenteredPowers(values, media, 4)
  const momentoCentral4 = sumaCuartosDesvios / n

  return {
    sumaCuartosDesvios,
    momentoCentral4,
    coeficienteCurtosis: momentoCentral4 / (desvioEstandar ** 4),
  }
}

/**
 * Calcula todos los estadísticos descriptivos para la lista de observaciones.
 */
export function computeDiscreteDescriptiveStats(
  values: readonly number[],
): DiscreteDescriptiveStats | { error: string } {
  if (values.length === 0) {
    return { error: "Se requiere al menos un valor." }
  }

  const n = values.length
  const sorted = [...values].sort((a, b) => a - b)
  const media = mean(values)
  const mediana = median(sorted)
  const moda = modes(values)
  const sumaDesviosAbsolutos = sumAbsoluteDeviations(values, media)
  const ss = sumSquaredDeviations(values, media)
  const { varianza, desvioEstandar } = calculatePopulationDispersion(ss, n)
  const { cuasiVarianza, cuasiDesvioEstandar } = calculateSampleDispersion(ss, n)
  const {
    coeficienteVariacionPoblacional,
    coeficienteVariacionMuestral,
  } = calculateVariationCoefficients(media, desvioEstandar, cuasiDesvioEstandar)
  const { coeficienteAsimetria, sumaCubosDesvios, momentoCentral3 } = calculateSkewness(
    values,
    n,
    media,
    desvioEstandar,
  )
  const {
    coeficienteCurtosis,
    sumaCuartosDesvios,
    momentoCentral4,
  } = calculateKurtosis(values, n, media, desvioEstandar)
  const sumaValores = values.reduce((a, b) => a + b, 0)
  const rango = sorted[sorted.length - 1]! - sorted[0]!

  return {
    n,
    media,
    mediana,
    moda,
    desvioMedio: sumaDesviosAbsolutos / n,
    rango,
    varianza,
    cuasiVarianza,
    desvioEstandar,
    cuasiDesvioEstandar,
    coeficienteVariacionPoblacional,
    coeficienteVariacionMuestral,
    coeficienteAsimetria,
    coeficienteCurtosis,
    sumaValores,
    sumaDesviosAbsolutos,
    sumaCuadradosDesvios: ss,
    sumaCubosDesvios,
    sumaCuartosDesvios,
    momentoCentral3,
    momentoCentral4,
  }
}

export function computeDiscreteFractile(
  values: readonly number[],
  probability: number,
): DiscreteFractile | null {
  if (values.length === 0 || probability <= 0 || probability > 1) {
    return null
  }

  const sorted = [...values].sort((a, b) => a - b)
  const target = probability * sorted.length

  if (
    Number.isInteger(target) &&
    target >= 1 &&
    target < sorted.length &&
    sorted[target - 1] !== sorted[target]
  ) {
    return [sorted[target - 1]!, sorted[target]!] as const
  }

  return sorted[Math.max(0, Math.ceil(target) - 1)] ?? null
}
