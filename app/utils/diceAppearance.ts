import type { FarkleDiceColor, FarkleDiceColorSetting } from '../../shared/games/farkle'

export interface DiceAppearance {
  bodyColor: string
  pipColor: string
}

type FixedDiceColorOption = DiceAppearance & {
  value: FarkleDiceColor
  label: string
  swatchClass: string
}

export const FARKLE_DICE_COLOR_OPTIONS = [
  { value: 'random', label: 'Random', swatchClass: 'bg-[conic-gradient(from_45deg,#fffdf7,#1d4ed8,#ea580c,#b91c1c,#15803d,#7e22ce,#111827,#0f766e,#fffdf7)]' },
  { value: 'ivory', label: 'Ivory', swatchClass: 'bg-[#fffdf7]' },
  { value: 'blue', label: 'Blue', swatchClass: 'bg-blue-700' },
  { value: 'orange', label: 'Orange', swatchClass: 'bg-orange-600' },
  { value: 'red', label: 'Red', swatchClass: 'bg-red-700' },
  { value: 'green', label: 'Green', swatchClass: 'bg-green-700' },
  { value: 'purple', label: 'Purple', swatchClass: 'bg-purple-700' },
  { value: 'black', label: 'Black', swatchClass: 'bg-slate-950' },
  { value: 'turquoise', label: 'Turquoise', swatchClass: 'bg-teal-700' }
] as const satisfies ReadonlyArray<{
  value: FarkleDiceColorSetting
  label: string
  swatchClass: string
}>

const FIXED_DICE_COLOR_OPTIONS: readonly FixedDiceColorOption[] = [
  { value: 'ivory', label: 'Ivory', swatchClass: 'bg-[#fffdf7]', bodyColor: '#fffdf7', pipColor: '#172033' },
  { value: 'blue', label: 'Blue', swatchClass: 'bg-blue-700', bodyColor: '#1d4ed8', pipColor: '#ffffff' },
  { value: 'orange', label: 'Orange', swatchClass: 'bg-orange-600', bodyColor: '#ea580c', pipColor: '#ffffff' },
  { value: 'red', label: 'Red', swatchClass: 'bg-red-700', bodyColor: '#b91c1c', pipColor: '#ffffff' },
  { value: 'green', label: 'Green', swatchClass: 'bg-green-700', bodyColor: '#15803d', pipColor: '#ffffff' },
  { value: 'purple', label: 'Purple', swatchClass: 'bg-purple-700', bodyColor: '#7e22ce', pipColor: '#ffffff' },
  { value: 'black', label: 'Black', swatchClass: 'bg-slate-950', bodyColor: '#111827', pipColor: '#ffffff' },
  { value: 'turquoise', label: 'Turquoise', swatchClass: 'bg-teal-700', bodyColor: '#0f766e', pipColor: '#ffffff' }
]

function hash(value: string): number {
  let result = 2166136261
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619)
  return result >>> 0
}

export function getFarkleDiceColorOption(color?: FarkleDiceColorSetting) {
  return FARKLE_DICE_COLOR_OPTIONS.find(option => option.value === color)
    ?? FARKLE_DICE_COLOR_OPTIONS.find(option => option.value === 'ivory')!
}

export function resolveDiceAppearance(color: FarkleDiceColorSetting | undefined, rollId: string): DiceAppearance {
  const fixedColor = color && color !== 'random' ? color : undefined
  return fixedColor
    ? FIXED_DICE_COLOR_OPTIONS.find(option => option.value === fixedColor) ?? FIXED_DICE_COLOR_OPTIONS[0]!
    : FIXED_DICE_COLOR_OPTIONS[hash(rollId) % FIXED_DICE_COLOR_OPTIONS.length]!
}
