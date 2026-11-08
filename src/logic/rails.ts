import type { Currency, Rail } from '../types';
import { businessDaysAfter } from './format';

export function railFor(currency: Currency, amount: number): Rail {
  if (currency === 'USD') return amount >= 1_000_000 ? 'Fedwire' : 'ACH';
  if (currency === 'EUR') return 'SEPA';
  return 'SWIFT';
}

export function arrivalFor(rail: Rail, today: string): string {
  switch (rail) {
    case 'Fedwire':
      return today;
    case 'ACH':
      return businessDaysAfter(today, 1);
    case 'SEPA':
      return businessDaysAfter(today, 1);
    case 'FAST':
      return today;
    case 'SWIFT':
    default:
      return businessDaysAfter(today, 2);
  }
}

export function railDescription(rail: Rail): string {
  switch (rail) {
    case 'ACH':
      return 'ACH. Next business day.';
    case 'Fedwire':
      return 'Fedwire. Same day.';
    case 'SEPA':
      return 'SEPA credit transfer. Next business day.';
    case 'SWIFT':
      return 'SWIFT. Two business days.';
    case 'FAST':
      return 'FAST. Same day.';
  }
}

/** CVB-ACH-2026111601 */
export function paymentReference(rail: Rail, today: string, seq: number): string {
  return `CVB-${rail.toUpperCase()}-${today.replace(/-/g, '')}${String(seq).padStart(2, '0')}`;
}
