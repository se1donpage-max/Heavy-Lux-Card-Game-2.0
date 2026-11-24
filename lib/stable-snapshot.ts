// API snapshots are JSON data. Preserve React identity when a poll changes nothing.
export function stableSnapshot<T>(previous: T, next: T): T {
  return previous === next || JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
}
