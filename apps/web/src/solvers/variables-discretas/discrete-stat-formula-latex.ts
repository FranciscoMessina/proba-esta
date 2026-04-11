import type { DiscreteDescriptiveStats } from "./discrete-descriptive-stats"

export type DiscreteStatFormulaId =
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
  | "coeficienteCurtosis"

function trimTrailingZeros(value: string): string {
  if (!value.includes(".")) {
    return value
  }

  return value.replace(/\.?0+$/, "")
}

function scientificToDecimal(value: string): string {
  const lower = value.toLowerCase()
  if (!lower.includes("e")) {
    return value
  }

  const [mantissa, exponentPart] = lower.split("e")
  const exponent = Number(exponentPart)
  const isNegative = mantissa.startsWith("-")
  const unsignedMantissa = isNegative ? mantissa.slice(1) : mantissa
  const [integerPart, fractionalPart = ""] = unsignedMantissa.split(".")
  const digits = `${integerPart}${fractionalPart}`
  const decimalIndex = integerPart.length + exponent

  let decimalValue: string
  if (decimalIndex <= 0) {
    decimalValue = `0.${"0".repeat(Math.abs(decimalIndex))}${digits}`
  } else if (decimalIndex >= digits.length) {
    decimalValue = `${digits}${"0".repeat(decimalIndex - digits.length)}`
  } else {
    decimalValue = `${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`
  }

  const normalized = trimTrailingZeros(decimalValue)
  if (normalized === "0") {
    return "0"
  }

  return isNegative ? `-${normalized}` : normalized
}

/** Números en notación que KaTeX interpreta bien (punto decimal, sin separador de miles). */
export function latexNum(n: number, maxFractionDigits?: number): string {
  if (!Number.isFinite(n)) {
    return "\\text{—}"
  }

  let s =
    maxFractionDigits === undefined
      ? scientificToDecimal(n.toString())
      : trimTrailingZeros(n.toFixed(maxFractionDigits))

  if (s === "-0") {
    s = "0"
  }
  return s
}

function sortedCopy(values: readonly number[]): number[] {
  return [...values].sort((a, b) => a - b)
}

function modaFrequencies(values: readonly number[]): Map<number, number> {
  const byValue = new Map<number, number>()
  for (const x of values) {
    byValue.set(x, (byValue.get(x) ?? 0) + 1)
  }
  return byValue
}

export function getDiscreteStatFormulaLatex(
  id: DiscreteStatFormulaId,
  stats: DiscreteDescriptiveStats,
  values: readonly number[],
): { general: string; substituted: string; explanation: string } | null {
  const { n, media, mediana, moda } = stats

  switch (id) {
    case "media": {
      const general =
        "\\bar{r} = \\dfrac{1}{n}\\sum_{i=1}^{n} r_i"
      const sum = stats.sumaValores
      const sub =
        n <= 10
          ? `\\bar{r} = \\dfrac{1}{${n}}(${values.map((x) => latexNum(x)).join("+")}) = \\dfrac{${latexNum(sum)}}{${n}} = ${latexNum(media)}`
          : `\\bar{r} = \\dfrac{1}{n}\\sum_i r_i = \\dfrac{1}{${n}}\\cdot${latexNum(sum)} = ${latexNum(media)}`
      return { general, substituted: sub, explanation: "La media o promedio es la suma de los valores dividido por el número de valores." }
    }
    case "mediana": {
      const ord = sortedCopy(values)
      const xs = ord.map((x) => latexNum(x)).join(",\\;")
      const general =
        "Me = \\text{valor central de los datos ordenados}"
      if (typeof mediana === "number") {
        const k = (n + 1) / 2
        const sub = `(${xs}) \\quad\\Rightarrow\\quad Me = r_{(${latexNum(k)})} = ${latexNum(mediana)}`
        return { general, substituted: sub, explanation: "La mediana es el valor central de los datos ordenados. Si el número de datos es impar, es el valor central. Si el número de datos es par, es un valor indefinido entre los dos valores centrales." }
      }
      const [a, b] = mediana
      const sub = `(${xs}) \\quad\\Rightarrow\\quad Me \\in \\{${latexNum(a)},\\;${latexNum(b)}\\}`
      return { general, substituted: sub, explanation: "La mediana es el valor central de los datos ordenados. Si el número de datos es impar, es el valor central. Si el número de datos es par, es un valor indefinido entre los dos valores centrales." }
    }
    case "moda": {
      const byValue = modaFrequencies(values)
      const pairs = [...byValue.entries()]
        .sort((u, v) => u[0] - v[0])
        .map(([x, f]) => `f_a(${latexNum(x)})=${f}`)
        .join(",\\;")
      const general =
        "Mo = \\arg\\max_r f_a(r)"
      if (moda.length === 0 && n > 1) {
        return {
          general,
          substituted: `\\forall r,\\; f_a(r)=1 \\Rightarrow \\text{no hay moda clara.}`,
          explanation: "La moda es el valor que aparece con mayor frecuencia en los datos. Puede haber más de una moda."
        }
      }
      if (moda.length === 0) {
        return null
      }
      const modaStr = moda.map((m) => latexNum(m)).join(",\\;")
      const sub = `${pairs} \\quad\\Rightarrow\\quad Mo \\in \\{${modaStr}\\}`
      return { general, substituted: sub, explanation: "La moda es el valor que aparece con mayor frecuencia en los datos. Puede haber más de una moda." }
    }
    case "desvioMedio": {
      const general =
        "DM = \\dfrac{1}{n}\\sum_{i=1}^{n}\\left|r_i-\\bar{r}\\right|"
      const sub = `DM = \\dfrac{1}{${n}}\\cdot${latexNum(stats.sumaDesviosAbsolutos)} = ${latexNum(stats.desvioMedio)}`
      return {
        general,
        substituted: sub,
        explanation: "El desvío medio es el promedio de las desviaciones absolutas respecto de la media.",
      }
    }
    case "rango": {
      const ord = sortedCopy(values)
      const min = ord[0]
      const max = ord[ord.length - 1]
      if (min === undefined || max === undefined) {
        return null
      }
      return {
        general: "R = r_{max} - r_{min}",
        substituted: `R = ${latexNum(max)} - ${latexNum(min)} = ${latexNum(stats.rango)}`,
        explanation: "El rango es la diferencia entre el valor máximo y el valor mínimo observados.",
      }
    }
    case "varianza": {
      const ss = stats.sumaCuadradosDesvios
      const general =
        "\\sigma^2 = \\dfrac{1}{n}\\sum_{i=1}^{n}(r_i-\\bar{r})^2"
      const sub = `\\sigma^2 = \\dfrac{1}{${n}}\\cdot${latexNum(ss)} = ${latexNum(stats.varianza)}`
      return { general, substituted: sub, explanation: "La varianza es la suma de los cuadrados de las desviaciones de los valores respecto de la media, dividido por el número de valores." }
    }
    case "cuasiVarianza": {
      const general =
        "s^2 = \\dfrac{1}{n-1}\\sum_{i=1}^{n}(r_i-\\bar{r})^2"
      if (stats.cuasiVarianza === null) {
        return {
          general,
          substituted: `n = ${n} < 2 \\Rightarrow s^2\\ \\text{y } s\\ \\text{no se definen (muestra de un solo dato).}`,
          explanation: "La cuasi-varianza es la suma de los cuadrados de las desviaciones de los valores respecto de la media, dividido por el número de valores menos uno."
        }
      }
      const ss = stats.sumaCuadradosDesvios
      const sub = `s^2 = \\dfrac{1}{${n - 1}}\\cdot${latexNum(ss)} = ${latexNum(stats.cuasiVarianza)}`
      return { general, substituted: sub, explanation: "La cuasi-varianza es la suma de los cuadrados de las desviaciones de los valores respecto de la media, dividido por el número de valores menos uno." }
    }
    case "desvioEstandar": {
      const general = "\\sigma = \\sqrt{\\sigma^2}"
      const sub = `\\sigma = \\sqrt{${latexNum(stats.varianza)}} = ${latexNum(stats.desvioEstandar)}`
      return { general, substituted: sub, explanation: "El desvío estándar es la raíz cuadrada de la varianza." }
    }
    case "cuasiDesvioEstandar": {
      const general = "s = \\sqrt{s^2}"
      if (stats.cuasiDesvioEstandar === null) {
        return {
          general,
          substituted: `n = ${n} < 2 \\Rightarrow s\\ \\text{no se define.}`,
          explanation: "El cuasi-desvío estándar es la raíz cuadrada de la cuasi-varianza. "
        }
      }
      const sub = `s = \\sqrt{${latexNum(stats.cuasiVarianza!)}} = ${latexNum(stats.cuasiDesvioEstandar)}`
      return { general, substituted: sub, explanation: "El cuasi-desvío estándar es la raíz cuadrada de la cuasi-varianza. " }
    }
    case "coeficienteVariacion": {
      const general =
        "\\mathrm{CV}_\\sigma = \\dfrac{\\sigma}{|\\bar{r}|},\\quad \\mathrm{CV}_s = \\dfrac{s}{|\\bar{r}|}"
      const explanation =
        "El coeficiente de variación relaciona el desvío típico con la media en valor absoluto: con σ (varianza poblacional) se obtiene CV_σ; con s (cuasi-varianza) se obtiene CV_s. No se define si la media es cero. CV_s requiere al menos dos datos."

      if (Math.abs(media) <= Number.EPSILON) {
        return {
          general,
          substituted:
            "\\bar{r} = 0 \\Rightarrow \\mathrm{CV}_\\sigma\\ \\text{y}\\ \\mathrm{CV}_s\\ \\text{no se definen.}",
          explanation,
        }
      }

      const cvP = stats.coeficienteVariacionPoblacional
      const cvM = stats.coeficienteVariacionMuestral
      if (cvP === null) {
        return null
      }

      if (n < 2 || stats.cuasiDesvioEstandar === null || cvM === null) {
        const sub = `\\mathrm{CV}_\\sigma = \\dfrac{${latexNum(stats.desvioEstandar)}}{|${latexNum(media)}|} = ${latexNum(cvP)}\\ (${latexNum(cvP * 100)}\\%)`
        return {
          general,
          substituted: `${sub} \\\\ n < 2 \\Rightarrow s\\ \\text{no definido;}\\ \\mathrm{CV}_s\\ \\text{no aplica.}`,
          explanation,
        }
      }

      const sub = `\\begin{aligned} \\mathrm{CV}_\\sigma &= \\dfrac{${latexNum(stats.desvioEstandar)}}{|${latexNum(media)}|} = ${latexNum(cvP)}\\ (${latexNum(cvP * 100)}\\%) \\\\ \\mathrm{CV}_s &= \\dfrac{${latexNum(stats.cuasiDesvioEstandar)}}{|${latexNum(media)}|} = ${latexNum(cvM)}\\ (${latexNum(cvM * 100)}\\%) \\end{aligned}`
      return { general, substituted: sub, explanation }
    }
    case "coeficienteAsimetria": {
      const general =
        "As = \\dfrac{\\dfrac{1}{n}\\sum_{i=1}^{n}(r_i-\\bar{r})^3}{\\sigma^3}"
      const explanation =
        "La asimetría se calcula como el tercer momento central dividido por n, estandarizado por σ^3, donde σ es el desvío estándar poblacional."
      if (stats.coeficienteAsimetria === null) {
        return {
          general,
          substituted:
            "σ \\approx 0 \\Rightarrow As\\ \\text{no se calcula.}",
          explanation,
        }
      }
      if (
        stats.sumaCubosDesvios === null ||
        stats.momentoCentral3 === null ||
        stats.desvioEstandar === null
      ) {
        return {
          general,
          substituted: `As = ${latexNum(stats.coeficienteAsimetria)}`,
          explanation,
        }
      }
      const sub =
        `As = \\dfrac{\\dfrac{${latexNum(stats.sumaCubosDesvios)}}{${n}}}{${latexNum(stats.desvioEstandar ** 3)}} = \\dfrac{${latexNum(stats.momentoCentral3)}}{${latexNum(stats.desvioEstandar ** 3)}} = ${latexNum(stats.coeficienteAsimetria)}`
      return { general, substituted: sub, explanation }
    }
    case "coeficienteCurtosis": {
      const general =
        "Ku = \\dfrac{\\dfrac{1}{n}\\sum_{i=1}^{n}(r_i-\\bar{r})^4}{\\sigma^4}"
      const explanation =
        "La curtosis se calcula como el cuarto momento central dividido por n, estandarizado por σ^4, donde σ es el desvío estándar poblacional."
      if (stats.coeficienteCurtosis === null) {
        return {
          general,
          substituted:
            "σ \\approx 0 \\Rightarrow Ku\\ \\text{no se calcula.}",
          explanation,
        }
      }
      if (
        stats.sumaCuartosDesvios === null ||
        stats.momentoCentral4 === null ||
        stats.desvioEstandar === null
      ) {
        return {
          general,
          substituted: `Ku = ${latexNum(stats.coeficienteCurtosis)}`,
          explanation,
        }
      }
      const sub =
        `Ku = \\dfrac{\\dfrac{${latexNum(stats.sumaCuartosDesvios)}}{${n}}}{${latexNum(stats.desvioEstandar ** 4)}} = \\dfrac{${latexNum(stats.momentoCentral4)}}{${latexNum(stats.desvioEstandar ** 4)}} = ${latexNum(stats.coeficienteCurtosis)}`
      return {
        general,
        substituted: sub,
        explanation,
      }
    }
    default:
      return null
  }
}
