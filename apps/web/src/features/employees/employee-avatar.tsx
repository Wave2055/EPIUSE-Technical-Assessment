import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { initials } from './format';
import type { Employee } from './types';

/** Initials-avatar tints, all dark enough for white text. Picked by hashing the id (ADR-0013). */
const TINTS = [
  '#021743',
  '#1f3a75',
  '#3b5ba9',
  '#2f5d62',
  '#5b3f8c',
  '#7a3b2e',
  '#355e3b',
  '#6b4e16',
];

function tintFor(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return TINTS[Math.abs(hash) % TINTS.length]!;
}

/**
 * Last link of the avatar chain: when `avatarUrl` is null or the Gravatar request 404s
 * (`d=404`), Radix swaps in the initials fallback.
 */
export function EmployeeAvatar({
  employee,
  className,
}: {
  employee: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
  className?: string;
}) {
  return (
    <Avatar className={cn('size-8', className)}>
      {employee.avatarUrl && <AvatarImage src={employee.avatarUrl} alt="" />}
      <AvatarFallback
        className="text-xs font-semibold text-white"
        style={{ backgroundColor: tintFor(employee.id) }}
      >
        {initials(employee)}
      </AvatarFallback>
    </Avatar>
  );
}
