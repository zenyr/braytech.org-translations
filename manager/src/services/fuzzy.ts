import { distance, matches } from "kled";

export interface FuzzyMatch<T> {
  item: T;
  score: number;
  matchedField: string;
}

export interface FuzzySearchOptions {
  /** minimum score threshold (default: 0.5) */
  threshold?: number;
  /** max results (default: 20) */
  limit?: number;
}

const DEFAULTS = {
  threshold: 0.5,
  limit: 20,
} as const;

/**
 * Calculate fuzzy score between query and single target string.
 */
function singleScore(query: string, target: string): number {
  // exact substring match → highest score
  if (target.includes(query)) {
    return 1.0;
  }

  // kled matches: supports Korean jamo partial matching (e.g., "ㅅㅎ" → "수호")
  // requires needle.length <= haystack.length
  if (query.length <= target.length) {
    return matches(query, target);
  }

  // fallback: Levenshtein distance → similarity
  const maxLen = Math.max(query.length, target.length);
  if (maxLen === 0) return 1.0;
  return 1 - distance(query, target) / maxLen;
}

/**
 * Calculate fuzzy score between query and target.
 * For dot-separated paths, compares against each segment and returns best score.
 */
export function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  // if target contains dots, compare against each segment
  if (t.includes(".")) {
    const segments = t.split(".");
    let best = 0;
    for (const seg of segments) {
      best = Math.max(best, singleScore(q, seg));
    }
    // also check full string
    return Math.max(best, singleScore(q, t));
  }

  return singleScore(q, t);
}

/**
 * Fuzzy search over items with multiple searchable fields.
 * Returns matches sorted by score (descending), filtered by threshold.
 */
export function fuzzySearch<T>(
  items: T[],
  query: string,
  getFields: (item: T) => Array<{ name: string; value: string }>,
  options?: FuzzySearchOptions
): FuzzyMatch<T>[] {
  const threshold = options?.threshold ?? DEFAULTS.threshold;
  const limit = options?.limit ?? DEFAULTS.limit;

  const matches: FuzzyMatch<T>[] = [];

  for (const item of items) {
    const fields = getFields(item);
    let bestScore = 0;
    let bestField = "";

    for (const { name, value } of fields) {
      const score = fuzzyScore(query, value);
      if (score > bestScore) {
        bestScore = score;
        bestField = name;
      }
    }

    if (bestScore >= threshold) {
      matches.push({ item, score: bestScore, matchedField: bestField });
    }
  }

  // sort by score desc, then limit
  return matches.sort((a, b) => b.score - a.score).slice(0, limit);
}
