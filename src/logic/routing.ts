import type { Currency, User } from '../types';
import { toUSD } from './fx';

export function canApprove(user: User | undefined, amount: number, currency: Currency): boolean {
  if (!user || user.portal !== 'kaltrex' || !user.approvalLimit) return false;
  return toUSD(amount, currency) <= user.approvalLimit;
}

/** Kaltrex users with enough authority for the amount, excluding the current user. */
export function eligibleApprovers(users: User[], amount: number, currency: Currency, excludeUserId?: string): User[] {
  const usd = toUSD(amount, currency);
  return users
    .filter((u) => u.portal === 'kaltrex' && !!u.approvalLimit && u.approvalLimit >= usd && u.id !== excludeUserId)
    .sort((a, b) => a.approvalLimit! - b.approvalLimit!);
}
