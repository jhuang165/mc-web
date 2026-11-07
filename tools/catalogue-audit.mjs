// Shared by the catalogue builders: the audit label and a status-count sentence computed from the generated rows, so the
// header counts cannot drift from the table. Rows are markdown table lines; the status cell is `fromEnd` cells from the end.
export const AUDIT = 'batch 19 audit';
const WORDS = ['Implemented', 'Partial', 'Missing', 'Out of scope', 'Unmapped', 'Not replayed', 'Native entry only', 'Unclassified', 'Abstract registration'];
export function countStatuses(rows, fromEnd = 3) {
  const counts = new Map();
  for (const line of rows) {
    const cells = line.split('|');
    const status = (cells[cells.length - fromEnd] ?? '').trim();
    const word = WORDS.find(w => status.startsWith(w)) ?? 'Other';
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return counts;
}
export function auditSentence(rows, fromEnd = 3, note = '') {
  const counts = countStatuses(rows, fromEnd);
  const parts = [...WORDS, 'Other'].filter(w => counts.get(w)).map(w => `${counts.get(w)} ${w}`);
  return `Status counts (${AUDIT}, ${rows.length} rows): ${parts.join(', ')}.${note ? ' ' + note : ''}`;
}
