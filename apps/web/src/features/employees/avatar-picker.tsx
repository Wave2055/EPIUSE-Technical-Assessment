import { AVATAR_CONTENT_TYPES, AVATAR_MAX_BYTES } from '@epiuse/shared';
import { ImageUp, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/errors';
import { AvatarUploadError, useEmployees, useRemoveAvatar, useUploadAvatar } from './api';
import { EmployeeAvatar } from './employee-avatar';
import { fullName } from './format';
import type { Employee } from './types';

/**
 * Upload or remove an employee's own picture (ADR-0013). It applies at once, apart from the
 * rest of the form, because it is a separate API call. The picture is read from the shared
 * list, so it updates as soon as the change lands.
 */
export function AvatarPicker({ employee }: { employee: Employee }) {
  const current = useEmployees().find((e) => e.id === employee.id) ?? employee;
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();
  const busy = upload.isPending || remove.isPending;

  const fail = (error: unknown) =>
    toast.error(error instanceof AvatarUploadError ? error.message : errorMessage(error));

  function onFile(file: File | undefined) {
    if (input.current) input.current.value = '';
    if (!file) return;
    upload.mutate(
      { id: current.id, file },
      {
        onSuccess: () => toast.success(`Updated ${fullName(current)}'s picture`),
        onError: fail,
      },
    );
  }

  function onRemove() {
    remove.mutate(current.id, {
      onSuccess: () => toast.success(`Removed ${fullName(current)}'s picture`),
      onError: fail,
    });
  }

  return (
    <div className="flex items-center gap-4 sm:col-span-2">
      <EmployeeAvatar employee={current} className="size-16 text-lg" />
      <div className="grid gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            <ImageUp /> {upload.isPending ? 'Uploading…' : 'Upload picture'}
          </Button>
          {current.hasUploadedAvatar && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={onRemove}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 /> {remove.isPending ? 'Removing…' : 'Remove picture'}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          PNG, JPEG or WebP, up to {AVATAR_MAX_BYTES / 1024 / 1024} MB.{' '}
          {current.hasUploadedAvatar
            ? 'Removing it goes back to their Gravatar.'
            : 'Without one, their Gravatar is shown.'}
        </p>
      </div>
      <input
        ref={input}
        type="file"
        accept={AVATAR_CONTENT_TYPES.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-label="Picture file"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
    </div>
  );
}
