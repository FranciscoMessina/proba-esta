export type GroupedDiscreteInputRow = {
  value: number
  frequency: number
}

export type GroupedDiscreteFrequencyRow = {
  item: number
  value: number
  absoluteFrequency: number
  relativeFrequency: number
  leftAbsoluteCumulativeFrequency: number
  leftRelativeCumulativeFrequency: number
  rightAbsoluteCumulativeFrequency: number
  rightRelativeCumulativeFrequency: number
}

export type GroupedDiscreteFrequencyTable = {
  classCount: number
  totalFrequency: number
  rows: GroupedDiscreteFrequencyRow[]
}

function sumFrequencies(rows: readonly GroupedDiscreteInputRow[]): number {
  return rows.reduce((total, row) => total + row.frequency, 0)
}

export function computeGroupedDiscreteFrequencyTable(
  input: readonly GroupedDiscreteInputRow[]
): GroupedDiscreteFrequencyTable | { error: string } {
  if (input.length === 0) {
    return { error: "Ingresá al menos una fila con valor y frecuencia." }
  }

  const seenValues = new Set<number>()

  for (let index = 0; index < input.length; index += 1) {
    const current = input[index]
    if (!current) {
      continue
    }

    if (!Number.isFinite(current.value)) {
      return { error: `La fila ${index + 1} tiene un valor no válido.` }
    }

    if (!Number.isInteger(current.frequency) || current.frequency <= 0) {
      return {
        error: `La fila ${index + 1} debe tener una frecuencia absoluta entera mayor que 0.`,
      }
    }

    if (seenValues.has(current.value)) {
      return {
        error: `El valor ${current.value} está repetido. Agrupá las repeticiones en una sola fila.`,
      }
    }

    seenValues.add(current.value)
  }

  const totalFrequency = sumFrequencies(input)
  let leftAbsoluteAccumulator = 0

  const rows = input.map((row, index) => {
    leftAbsoluteAccumulator += row.frequency

    const rightAbsoluteCumulativeFrequency =
      totalFrequency - (leftAbsoluteAccumulator - row.frequency)

    return {
      item: index + 1,
      value: row.value,
      absoluteFrequency: row.frequency,
      relativeFrequency: row.frequency / totalFrequency,
      leftAbsoluteCumulativeFrequency: leftAbsoluteAccumulator,
      leftRelativeCumulativeFrequency: leftAbsoluteAccumulator / totalFrequency,
      rightAbsoluteCumulativeFrequency,
      rightRelativeCumulativeFrequency:
        rightAbsoluteCumulativeFrequency / totalFrequency,
    }
  })

  return {
    classCount: rows.length,
    totalFrequency,
    rows,
  }
}
