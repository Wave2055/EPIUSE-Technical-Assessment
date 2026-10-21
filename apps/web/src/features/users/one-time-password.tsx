import { Check, Copy, KeyRound } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  clearOneTimePassword,
  currentOneTimePassword,
  subscribeOneTimePassword,
} from './one-time-password-store';

/** Mounted once in the app shell. Closing it discards the password for good. */
export function OneTimePasswordDialog() {
  const issued = useSyncExternalStore(subscribeOneTimePassword, currentOneTimePassword);
  const [copied, setCopied] = useState(false);

  function close() {
    setCopied(false);
    clearOneTimePassword();
  }

  async function copy() {
    if (!issued) return;
    await navigator.clipboard.writeText(issued.temporaryPassword);
    setCopied(true);
  }

  return (
    <Dialog open={issued !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-muted-foreground" />
            {issued?.reason === 'reset' ? 'New one-time password' : 'Login created'}
          </DialogTitle>
          <DialogDescription>
            {issued?.reason === 'reset'
              ? `${issued.name}'s old password no longer works. Give them this one privately.`
              : `${issued?.name} can now sign in. Give them these details privately.`}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 rounded-md bg-muted p-4 text-sm">
          <dt className="text-muted-foreground">Email</dt>
          <dd className="font-medium break-all">{issued?.email}</dd>
          <dt className="text-muted-foreground">Password</dt>
          <dd className="flex items-center justify-between gap-2">
            <code
              aria-label="One-time password"
              className="font-mono text-base tracking-wider text-heading select-all"
            >
              {issued?.temporaryPassword}
            </code>
            <Button size="sm" variant="outline" onClick={() => void copy()}>
              {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy'}
            </Button>
          </dd>
        </dl>

        <p className="text-sm text-muted-foreground">
          This won&apos;t be shown again. They&apos;ll choose their own password the first time they
          sign in.
        </p>

        <DialogFooter>
          <Button onClick={close}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
