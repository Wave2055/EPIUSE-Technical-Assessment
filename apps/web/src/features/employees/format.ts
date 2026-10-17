import type { Employee } from './types';

const salaryFormat = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
  maximumFractionDigits: 0,
});

const dateFormat = new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium' });
const dateTimeFormat = new Intl.DateTimeFormat('en-ZA', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export const fullName = (e: Pick<Employee, 'firstName' | 'lastName'>) =>
  `${e.firstName} ${e.lastName}`;

export const initials = (e: Pick<Employee, 'firstName' | 'lastName'>) =>
  `${e.firstName[0] ?? ''}${e.lastName[0] ?? ''}`.toUpperCase();

export const formatSalary = (salary: number | null) =>
  salary === null ? 'Hidden' : salaryFormat.format(salary);

/** Parses `YYYY-MM-DD` as a local date, so the day never shifts across time zones. */
export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const formatDate = (iso: string) => dateFormat.format(parseIsoDate(iso));
export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso));
