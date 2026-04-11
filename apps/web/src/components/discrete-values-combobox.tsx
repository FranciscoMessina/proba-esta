import {
  Fragment,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
} from "react"

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxValue,
} from "@workspace/ui/components/combobox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@workspace/ui/components/field"
import {
  parseDiscreteValues,
  parseNumericToken,
} from "@/solvers/variables-discretas/discrete-descriptive-stats"

const formatChip = (n: number) =>
  new Intl.NumberFormat("es", {
    maximumFractionDigits: 8,
    minimumFractionDigits: 0,
  }).format(n)

export type DiscreteValueChip = { id: string; value: number }

export type DiscreteValuesComboboxHandle = {
  prepareValues: () =>
    | { ok: true; values: number[] }
    | { ok: false; error: string }
}

type DiscreteValuesComboboxProps = {
  id: string
  /** Si es true, las etiquetas se muestran en orden creciente y prepareValues devuelve el arreglo ordenado. */
  autoSort: boolean
}

function newChip(value: number): DiscreteValueChip {
  return { id: crypto.randomUUID(), value }
}

/** Orden creciente por valor; empates estables por id. */
function sortChipsStable(chips: readonly DiscreteValueChip[]): DiscreteValueChip[] {
  return [...chips].sort((a, b) => {
    if (a.value !== b.value) {
      return a.value - b.value
    }
    return a.id.localeCompare(b.id)
  })
}

function sortNumbersAscending(values: readonly number[]): number[] {
  return [...values].sort((a, b) => a - b)
}

export const DiscreteValuesCombobox = forwardRef<
  DiscreteValuesComboboxHandle,
  DiscreteValuesComboboxProps
>(function DiscreteValuesCombobox({ id, autoSort }, ref) {
  const [chips, setChips] = useState<DiscreteValueChip[]>([])
  const [inputValue, setInputValue] = useState("")
  const [commitError, setCommitError] = useState<string | null>(null)

  const displayChips = useMemo(
    () => (autoSort ? sortChipsStable(chips) : chips),
    [chips, autoSort],
  )

  const tryCommitInput = useCallback(
    (raw: string, clearInput: boolean): boolean => {
      const t = raw.trim()
      if (!t) {
        return true
      }
      const n = parseNumericToken(t)
      if (n === null) {
        setCommitError(`«${t}» no es un número válido.`)
        return false
      }
      setChips((prev) => [...prev, newChip(n)])
      if (clearInput) {
        setInputValue("")
      }
      setCommitError(null)
      return true
    },
    [],
  )

  const handleChipsInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        tryCommitInput(e.currentTarget.value, true)
        return
      }
      if (e.key === " " || e.key === "Spacebar") {
        if (e.currentTarget.value.trim()) {
          e.preventDefault()
          tryCommitInput(e.currentTarget.value, true)
        }
        return
      }
      if (e.key === ",") {
        e.preventDefault()
        if (e.currentTarget.value.trim()) {
          tryCommitInput(e.currentTarget.value, true)
        }
      }
    },
    [tryCommitInput],
  )

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text")
    if (!text.trim()) {
      return
    }
    const parsed = parseDiscreteValues(text)
    if (!parsed.ok) {
      e.preventDefault()
      setCommitError(parsed.error)
      return
    }
    e.preventDefault()
    setChips((prev) => [...prev, ...parsed.values.map((v) => newChip(v))])
    setInputValue("")
    setCommitError(null)
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      prepareValues() {
        setCommitError(null)
        const nums = chips.map((c) => c.value)
        const d = inputValue.trim()
        if (d) {
          const n = parseNumericToken(d)
          if (n === null) {
            const msg = `«${d}» no es un número válido.`
            setCommitError(msg)
            return { ok: false, error: msg }
          }
          nums.push(n)
          setChips((prev) => [...prev, newChip(n)])
          setInputValue("")
        }
        if (nums.length === 0) {
          const msg = "Agregue al menos un valor."
          setCommitError(msg)
          return { ok: false, error: msg }
        }
        return {
          ok: true,
          values: autoSort ? sortNumbersAscending(nums) : nums,
        }
      },
    }),
    [autoSort, chips, inputValue],
  )

  return (
    <Field data-invalid={commitError ? true : undefined}>
      <FieldLabel htmlFor={id}>Valores</FieldLabel>
      <FieldDescription>
        Ingresar valores separados por comas, espacios o punto y coma. Usar{" "}
        <kbd className="bg-muted rounded px-1 py-px text-xs">Enter</kbd>,{" "}
        <kbd className="bg-muted rounded px-1 py-px text-xs">espacio</kbd> o{" "}
        <kbd className="bg-muted rounded px-1 py-px text-xs">,</kbd>. Decimales
        con punto (ej. <span className="font-mono text-xs">3.14</span>). Podés
        pegar varios números a la vez.
      </FieldDescription>
      <Combobox<DiscreteValueChip, true>
        multiple
        open={false}
        onOpenChange={() => undefined}
        items={[]}
        value={displayChips}
        onValueChange={(next) => {
          const ids = new Set((next ?? []).map((c) => c.id))
          setChips((prev) => prev.filter((c) => ids.has(c.id)))
          setCommitError(null)
        }}
        inputValue={inputValue}
        onInputValueChange={(v) => {
          setInputValue(v)
          setCommitError(null)
        }}
        itemToStringValue={(item) => String(item.value)}
        isItemEqualToValue={(a, b) => a.id === b.id}
      >
        <ComboboxChips className="w-full min-h-10">
          <ComboboxValue>
            {(selected: DiscreteValueChip[]) => (
              <Fragment>
                {selected.map((chip) => (
                  <ComboboxChip
                    key={chip.id}
                    showRemove
                    className="bg-background inline-flex h-auto items-center gap-1  border py-0.5 pl-2 text-xs font-medium shadow-xs **:data-[slot=combobox-chip-remove]:mr-0.5 **:data-[slot=combobox-chip-remove]:bg-transparent"
                  >
                    <span className="font-mono tabular-nums">
                      {formatChip(chip.value)}
                    </span>
                  </ComboboxChip>
                ))}
                <ComboboxChipsInput
                  id={id}
                  placeholder="Escribí un número…"
                  className="bg-transparent"
                  aria-invalid={commitError ? true : undefined}
                  onKeyDown={handleChipsInputKeyDown}
                  onPaste={handlePaste}
                />
              </Fragment>
            )}
          </ComboboxValue>
        </ComboboxChips>
      </Combobox>
      {displayChips.length > 0 ? <p className="text-muted-foreground text-xs">
        {displayChips.length} valores ingresados.
      </p> : null}
      {commitError ? <FieldError>{commitError}</FieldError> : null}
    </Field>
  )
})
