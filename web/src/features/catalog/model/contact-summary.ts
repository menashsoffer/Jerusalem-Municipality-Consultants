/** Contact values load with the supplier's details, so the card only says what exists. */
export function contactSummary(kinds: string[]): string {
  const found = [kinds.includes('phone') && 'טלפון', kinds.includes('email') && 'דוא״ל'];
  const labels = found.filter((label): label is string => typeof label === 'string');
  return labels.length ? `יש במאגר: ${labels.join(' ו')}` : 'אין טלפון או דוא״ל במאגר';
}
