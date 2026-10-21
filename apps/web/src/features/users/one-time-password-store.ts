/**
 * A one-time password, shown to the admin who issued it exactly once (ADR-0036). Held in a
 * small store rather than component state, because the form that created the employee closes
 * as soon as it saves, and the password must outlive it.
 */
export interface IssuedPassword {
  name: string;
  email: string;
  temporaryPassword: string;
  reason: 'created' | 'reset';
}

let current: IssuedPassword | null = null;
const listeners = new Set<() => void>();
const set = (next: IssuedPassword | null) => {
  current = next;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const showOneTimePassword = (issued: IssuedPassword) => set(issued);
export const clearOneTimePassword = () => set(null);
export const currentOneTimePassword = () => current;
export const subscribeOneTimePassword = subscribe;
