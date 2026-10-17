import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware class merge. Required by the shadcn/ui component convention (ADR-0005). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
