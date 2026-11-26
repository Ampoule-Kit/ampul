export type ListEntryOutcome<Item> =
  | { kind: 'add'; items: Item[] }
  | { kind: 'finish' }
  | { kind: 'problem'; message: string }
  | { kind: 'nothing' }
