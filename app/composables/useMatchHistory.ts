import type { MatchHistoryItem } from '../../shared/types/api'

export const useMatchHistory = createUseFetch<{ matches: MatchHistoryItem[] }>({
  key: 'match-history',
  cache: 'no-store',
  getCachedData(key, nuxtApp) {
    return nuxtApp.isHydrating ? nuxtApp.payload.data[key] : undefined
  }
})

export function invalidateMatchHistory() {
  clearNuxtData('match-history')
}
