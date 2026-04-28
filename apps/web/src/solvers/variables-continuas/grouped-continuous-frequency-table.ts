export type GroupedContinuousInputRow = {
  lowerLimit: number
  upperLimit: number
  frequency: number
}

export type GroupedContinuousFrequencyRow = {
  item: number
  lowerLimit: number
  upperLimit: number
  amplitude: number
  classMark: number
  absoluteFrequency: number
  relativeFrequency: number
  leftAbsoluteCumulativeFrequency: number
  leftRelativeCumulativeFrequency: number
  rightAbsoluteCumulativeFrequency: number
  rightRelativeCumulativeFrequency: number
}

export type GroupedContinuousFrequencyTable = {
  classCount: number
  totalFrequency: number
  rows: GroupedContinuousFrequencyRow[]
}

function sumFrequencies(rows: readonly GroupedContinuousInputRow[]): number {
  return rows.reduce((total, row) => total + row.frequency, 0)
}

export function computeGroupedContinuousFrequencyTable(
  input: readonly GroupedContinuousInputRow[]
): GroupedContinuousFrequencyTable | { error: string } {
  if (input.length === 0) {
    return {
      error: "Ingresá al menos una fila con límite inferior, límite superior y frecuencia.",
    }
  }

  for (let index = 0; index < input.length; index += 1) {
    const current = input[index]
    if (!current) {
      continue
    }

    if (!Number.isFinite(current.lowerLimit) || !Number.isFinite(current.upperLimit)) {
      return {
        error: `La fila ${index + 1} tiene límites de intervalo no válidos.`,
      }
    }

    if (current.upperLimit <= current.lowerLimit) {
      return {
        error: `La fila ${index + 1} debe tener un límite superior mayor que el inferior.`,
      }
    }

    if (!Number.isFinite(current.frequency) || current.frequency <= 0) {
      return {
        error: `La fila ${index + 1} debe tener una frecuencia absoluta numérica mayor que 0.`,
      }
    }

    if (index === 0) {
      continue
    }

    const previous = input[index - 1]
    if (!previous) {
      continue
    }

    if (current.lowerLimit < previous.lowerLimit) {
      return {
        error: "Los intervalos deben estar cargados de menor a mayor.",
      }
    }

    if (current.lowerLimit < previous.upperLimit) {
      return {
        error: `El intervalo de la fila ${index + 1} se superpone con el de la fila ${index}.`,
      }
    }
  }

  const totalFrequency = sumFrequencies(input)
  let leftAbsoluteAccumulator = 0

  const rows = input.map((row, index) => {
    leftAbsoluteAccumulator += row.frequency

    const rightAbsoluteCumulativeFrequency =
      totalFrequency - (leftAbsoluteAccumulator - row.frequency)

    return {
      item: index + 1,
      lowerLimit: row.lowerLimit,
      upperLimit: row.upperLimit,
      amplitude: row.upperLimit - row.lowerLimit,
      classMark: (row.lowerLimit + row.upperLimit) / 2,
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
