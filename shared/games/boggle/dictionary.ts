import american10 from 'wordlist-english/american-words-10.json' with { type: 'json' }
import american20 from 'wordlist-english/american-words-20.json' with { type: 'json' }
import american35 from 'wordlist-english/american-words-35.json' with { type: 'json' }
import american40 from 'wordlist-english/american-words-40.json' with { type: 'json' }
import american50 from 'wordlist-english/american-words-50.json' with { type: 'json' }
import american55 from 'wordlist-english/american-words-55.json' with { type: 'json' }
import american60 from 'wordlist-english/american-words-60.json' with { type: 'json' }
import american70 from 'wordlist-english/american-words-70.json' with { type: 'json' }
import english10 from 'wordlist-english/english-words-10.json' with { type: 'json' }
import english20 from 'wordlist-english/english-words-20.json' with { type: 'json' }
import english35 from 'wordlist-english/english-words-35.json' with { type: 'json' }
import english40 from 'wordlist-english/english-words-40.json' with { type: 'json' }
import english50 from 'wordlist-english/english-words-50.json' with { type: 'json' }
import english55 from 'wordlist-english/english-words-55.json' with { type: 'json' }
import english60 from 'wordlist-english/english-words-60.json' with { type: 'json' }
import english70 from 'wordlist-english/english-words-70.json' with { type: 'json' }

export const BOGGLE_DICTIONARY_VERSION = 'wordlist-english@1.2.1-scowl-en-US-70'

// Import the data files directly instead of the package entry point, which
// reads them with node:fs and therefore cannot run inside a Cloudflare Worker.
// SCOWL's `words` lists omit its proper-name and abbreviation categories.
const englishWords = [
  ...english10,
  ...english20,
  ...english35,
  ...english40,
  ...english50,
  ...english55,
  ...english60,
  ...english70,
  ...american10,
  ...american20,
  ...american35,
  ...american40,
  ...american50,
  ...american55,
  ...american60,
  ...american70
].sort()

function lowerBound(value: string): number {
  let low = 0
  let high = englishWords.length
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (englishWords[middle]! < value) low = middle + 1
    else high = middle
  }
  return low
}

export function boggleDictionaryHas(word: string): boolean {
  return englishWords[lowerBound(word)] === word
}

export function boggleDictionaryHasPrefix(prefix: string): boolean {
  return englishWords[lowerBound(prefix)]?.startsWith(prefix) ?? false
}
