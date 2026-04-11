import { createFileRoute } from "@tanstack/react-router"
import { useRef, useState, type ReactNode } from "react"
import {
  DiscreteValuesCombobox,
  type DiscreteValuesComboboxHandle,
} from "@/components/discrete-values-combobox"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Switch } from "@workspace/ui/components/switch"
import {
  StatFormulaDialog,
  type StatFormulaDialogProps,
} from "@/components/stat-formula-dialog"
import {
  computeDiscreteFractile,
  computeDiscreteDescriptiveStats,
  type DiscreteDescriptiveStats,
} from "@/solvers/variables-discretas/discrete-descriptive-stats"
import {
  getDiscreteStatFormulaLatex,
  type DiscreteStatFormulaId,
} from "@/solvers/variables-discretas/discrete-stat-formula-latex"
import { Input } from "@workspace/ui/components/input"

export const Route = createFileRoute("/estadisticas/variables-discretas")({
  component: VariablesDiscretasPage,
})

const fmt = (value: number | null | undefined, empty = "—") => {
  if (value === null || value === undefined) {
    return empty
  }
  return new Intl.NumberFormat("es", {
    maximumFractionDigits: 4,
    minimumFractionDigits: 0,
  }).format(value)
}

/** Coeficiente de variación: valor adimensional y equivalente en porcentaje. */
function formatCvDecimalAndPercent(cv: number | null, empty = "—"): string {
  if (cv === null) {
    return empty
  }
  const dec = fmt(cv)
  const pct = new Intl.NumberFormat("es", {
    style: "percent",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(cv)
  return `${dec} (${pct})`
}

function parseFractilePercent(raw: string): number | null {
  const parsed = Number(raw.replace(",", "."))
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) {
    return null
  }

  return parsed / 100
}

function formatFractileResult(
  result: number | readonly [number, number] | null,
): string {
  if (result === null) {
    return "—"
  }

  if (Array.isArray(result)) {
    return result.map((value) => fmt(value)).join(" y ")
  }

  if (typeof result === "number") {
    return fmt(result)
  }

  return "—"
}

function discreteStatFormulaProps(
  statId: DiscreteStatFormulaId,
  title: string,
  stats: DiscreteDescriptiveStats,
  values: readonly number[],
): StatFormulaDialogProps | null {
  const data = getDiscreteStatFormulaLatex(statId, stats, values)
  if (!data) {
    return null
  }
  return {
    title,
    generalLatex: data.general,
    substitutedLatex: data.substituted,
    explanation: data.explanation
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
        <span className="text-foreground">{label}</span>
        {hint ? (
          <p className="text-muted-foreground text-xs leading-snug [&_.katex]:text-[0.95em]">
            {hint}
          </p>
        ) : null}
      </div>
      <div className="flex items-baseline justify-end gap-1 sm:gap-2">
        <div className="font-mono text-sm tabular-nums">{value}</div>
        {formula ? <StatFormulaDialog {...formula} /> : null}
      </div>
    </div>
  )
}

function formatModa(stats: DiscreteDescriptiveStats): string {
  if (stats.moda.length === 0) {
    return "Sin moda clara (misma frecuencia para todos)"
  }
  return stats.moda.map((m) => fmt(m)).join(", ")
}

function VariablesDiscretasPage() {
  const valuesRef = useRef<DiscreteValuesComboboxHandle>(null)
  const [ordenAuto, setOrdenAuto] = useState(false)
  const [fractilePercent, setFractilePercent] = useState("50")
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<DiscreteDescriptiveStats | null>(null)
  const [muestra, setMuestra] = useState<readonly number[] | null>(null)

  function handleCalcular() {
    setError(null)
    setStats(null)
    setMuestra(null)

    const prepared = valuesRef.current?.prepareValues()
    if (!prepared?.ok) {
      return
    }

    const result = computeDiscreteDescriptiveStats(prepared.values)
    if ("error" in result) {
      setError(result.error)
      return
    }

    setStats(result)
    setMuestra(prepared.values)
  }

  return (
    <div className="flex max-w-2xl min-w-0 flex-col gap-6 text-sm leading-relaxed">
      <div>
        <h1 className="font-medium text-base">Variables Discretas</h1>
        <p className="text-muted-foreground mt-1">
          Agregá los valores a utilizar. Se calculan media, mediana, moda,
          varianzas, desvíos, coeficiente de variación, asimetría, curtosis,
          desvío medio, rango y fractiles.
        </p>
      </div>

      <FieldGroup className="gap-4">
        <Field>
          <div className="flex flex-row flex-wrap items-center gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <FieldLabel htmlFor="orden-auto-valores">
                Ordenar valores automáticamente
              </FieldLabel>
              <FieldDescription>
                Mostrar las etiquetas en orden numérico creciente
                y usar ese mismo orden al calcular (la muestra es la misma; solo
                cambia el orden).
              </FieldDescription>
            </div>
            <Switch
              id="orden-auto-valores"
              checked={ordenAuto}
              onCheckedChange={setOrdenAuto}
            />
          </div>
        </Field>
        <DiscreteValuesCombobox
          ref={valuesRef}
          id="discrete-values"
          autoSort={ordenAuto}
        />
        <Button type="button" className="w-fit" onClick={handleCalcular}>
          Calcular
        </Button>
      </FieldGroup>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {stats && muestra ? (
        <div className="border-border rounded-md border px-4 py-2">
          <h2 className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
            Resultados (n = {stats.n})
          </h2>
          <div>
            <StatRow
              label="Media"
              value={fmt(stats.media)}
              formula={discreteStatFormulaProps(
                "media",
                "Media",
                stats,
                muestra,
              )}
            />
            <StatRow
              label="Mediana"
              value={
                Array.isArray(stats.mediana)
                  ? stats.mediana.map((m) => fmt(m)).join(", ")
                  : fmt(stats.mediana)
              }
              formula={discreteStatFormulaProps(
                "mediana",
                "Mediana",
                stats,
                muestra,
              )}
            />
            <StatRow
              label="Moda"
              value={formatModa(stats)}
              formula={discreteStatFormulaProps(
                "moda",
                "Moda",
                stats,
                muestra,
              )}
            />
            <StatRow
              label="Desvío medio"
              value={fmt(stats.desvioMedio)}
              formula={discreteStatFormulaProps(
                "desvioMedio",
                "Desvío medio",
                stats,
                muestra,
              )}
            />
            <StatRow
              label="Rango"
              value={fmt(stats.rango)}
              formula={discreteStatFormulaProps(
                "rango",
                "Rango",
                stats,
                muestra,
              )}
            />
            <StatRow
              label="Varianza"
              value={fmt(stats.varianza)}
              formula={discreteStatFormulaProps(
                "varianza",
                "Varianza poblacional",
                stats,
                muestra,
              )}
            />
            <StatRow
              label="Cuasi-varianza"
              value={fmt(stats.cuasiVarianza)}
              formula={discreteStatFormulaProps(
                "cuasiVarianza",
                "Cuasi-varianza muestral",
                stats,
                muestra,
              )}
            />
            <StatRow
              label="Desvío estándar "
              value={fmt(stats.desvioEstandar)}
              formula={discreteStatFormulaProps(
                "desvioEstandar",
                "Desvío estándar poblacional",
                stats,
                muestra,
              )}
            />
            <StatRow
              label="Cuasi-desvío estándar"
              value={fmt(stats.cuasiDesvioEstandar)}
              formula={discreteStatFormulaProps(
                "cuasiDesvioEstandar",
                "Cuasi-desvío estándar muestral",
                stats,
                muestra,
              )}
            />
            <StatRow
              label="Coeficiente de variación"
              value={
                <div className="flex flex-col items-end gap-1.5">
                  <div className="text-right">
                    <div>
                      Poblacional:{" "}
                      {formatCvDecimalAndPercent(
                        stats.coeficienteVariacionPoblacional,
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div>
                      Muestral:{" "}
                      {formatCvDecimalAndPercent(
                        stats.coeficienteVariacionMuestral,
                      )}
                    </div>
                  </div>
                </div>
              }
              formula={discreteStatFormulaProps(
                "coeficienteVariacion",
                "Coeficiente de variación",
                stats,
                muestra,
              )}
            />
            <StatRow
              label="Coeficiente de asimetría"
              value={fmt(stats.coeficienteAsimetria)}
              formula={discreteStatFormulaProps(
                "coeficienteAsimetria",
                "Coeficiente de asimetría",
                stats,
                muestra,
              )}
            />
            <StatRow
              label="Coeficiente de curtosis"
              value={fmt(stats.coeficienteCurtosis)}
              formula={discreteStatFormulaProps(
                "coeficienteCurtosis",
                "Coeficiente de curtosis",
                stats,
                muestra,
              )}
            />
          </div>
        </div>
      ) : null}

      {stats && muestra ? (
        <div className="border-border rounded-md border px-4 py-3">
          <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Fractil
          </h2>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full max-w-xs">
              <FieldLabel htmlFor="discrete-fractile-percent">
                Porcentaje acumulado a la izquierda
              </FieldLabel>
              <Input
                id="discrete-fractile-percent"
                inputMode="decimal"
                className="mt-1"
                value={fractilePercent}
                onChange={(event) => setFractilePercent(event.currentTarget.value)}
                placeholder="Ej. 90"
              />
            </div>
            <div className="min-w-0 flex-1 rounded-md bg-muted/30 px-3 py-2">
              <div className="text-xs text-muted-foreground">
                {parseFractilePercent(fractilePercent) === null
                  ? "Ingresá un porcentaje entre 0 y 100."
                  : `Fractil del ${fmt((parseFractilePercent(fractilePercent) ?? 0) * 100)}%`}
              </div>
              <div className="font-mono text-sm tabular-nums">
                {formatFractileResult(
                  computeDiscreteFractile(
                    muestra,
                    parseFractilePercent(fractilePercent) ?? 0,
                  ),
                )}
              </div>
            </div>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            Si el porcentual cae exactamente entre dos posiciones centrales
            distintas, el fractil queda comprendido entre ambos valores.
          </p>
        </div>
      ) : null}
    </div>
  )
}
