import type { BoggleBoardColor } from '../../shared/games/boggle'

export const BOGGLE_BOARD_COLOR_OPTIONS = [
  { value: 'blue', label: 'Blue', backgroundClass: 'bg-blue-700' },
  { value: 'orange', label: 'Orange', backgroundClass: 'bg-orange-600' },
  { value: 'red', label: 'Red', backgroundClass: 'bg-red-700' },
  { value: 'green', label: 'Green', backgroundClass: 'bg-green-700' },
  { value: 'purple', label: 'Purple', backgroundClass: 'bg-purple-700' },
  { value: 'black', label: 'Black', backgroundClass: 'bg-black' },
  { value: 'turquoise', label: 'Turquoise', backgroundClass: 'bg-teal-500' }
] as const satisfies ReadonlyArray<{
  value: BoggleBoardColor
  label: string
  backgroundClass: string
}>

export function getBoggleBoardColorOption(color?: BoggleBoardColor) {
  return BOGGLE_BOARD_COLOR_OPTIONS.find(option => option.value === color) ?? BOGGLE_BOARD_COLOR_OPTIONS[0]
}
