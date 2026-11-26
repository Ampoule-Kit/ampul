export interface SelectableOption<Value> {
  value: Value
  exclusiveGroup?: string | undefined
}

export function toggleSelection<Value>(
  selection: Value[],
  toggled: SelectableOption<Value>,
  options: SelectableOption<Value>[],
): Value[] {
  if (selection.includes(toggled.value)) {
    return selection.filter((value) => value !== toggled.value)
  }
  const otherValuesInGroup = toggled.exclusiveGroup
    ? options
        .filter((option) => option.exclusiveGroup === toggled.exclusiveGroup)
        .map((option) => option.value)
    : []
  return [...selection.filter((value) => !otherValuesInGroup.includes(value)), toggled.value]
}
