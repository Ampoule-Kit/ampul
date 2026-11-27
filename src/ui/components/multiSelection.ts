export interface SelectableOption<Value> {
  value: Value
  exclusiveWith?: Value[] | undefined
}

export function toggleSelection<Value>(
  selection: Value[],
  toggled: SelectableOption<Value>,
): Value[] {
  if (selection.includes(toggled.value)) {
    return selection.filter((value) => value !== toggled.value)
  }
  const excluded = toggled.exclusiveWith ?? []
  return [...selection.filter((value) => !excluded.includes(value)), toggled.value]
}
