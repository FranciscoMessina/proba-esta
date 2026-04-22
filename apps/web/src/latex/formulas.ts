import type { DiscreteDescriptiveStats } from "@/solvers/variables-discretas/discrete-descriptive-stats"
import { latexNum } from "@/solvers/variables-discretas/discrete-stat-formula-latex"

function alignedLatex(lines: readonly string[]): string {
  return `\\begin{gathered}${lines.join(" \\\\[16pt] ")}\\end{gathered}`
}

export const Discretas = {
  Media: {
    General: "\\bar{r} = \\dfrac{1}{n}\\sum_{i=1}^n r_i",
    Reemplazo(values: readonly number[], stats: DiscreteDescriptiveStats) {
      return alignedLatex([
        `\\bar{r} = \\dfrac{1}{${stats.n}}(${values.map((x) => latexNum(x)).join("+")})`,
        `\\bar{r} = \\dfrac{${stats.sumaValores}}{${stats.n}}`,
      ])
    },
  },
  Mediana: {
    General: "Me = \\text{valor central de los datos ordenados}",
    Reemplazo(values: readonly number[], stats: DiscreteDescriptiveStats) {
      const ordered = [...values].sort((a, b) => a - b)
      const listString = ordered.map((x) => latexNum(x)).join(",\\;")

      if (typeof stats.mediana === "number") {
        const k = (stats.n + 1) / 2

        return `(${listString}) \\quad\\Rightarrow\\quad Me = r_{(${latexNum(k)})} = ${latexNum(stats.mediana)}`
      }
      const [a, b] = stats.mediana
      return `(${listString}) \\quad\\Rightarrow\\quad Me \\in \\{${latexNum(a)},\\;${latexNum(b)}\\}`
    },
  },
  Moda: {
    General: "Mo = \\arg\\max_r f_a(r)",
  },
}
