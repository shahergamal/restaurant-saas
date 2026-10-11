'use client';

import * as M from '@radix-ui/react-dropdown-menu';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/cn';

export function MenuRoot(props: M.DropdownMenuProps) {
  const { dir } = useI18n();
  return <M.Root dir={dir} modal={false} {...props} />;
}
export const MenuTrigger = M.Trigger;

export function MenuContent({ children, align = 'end', className }: { children: React.ReactNode; align?: 'start' | 'end' | 'center'; className?: string }) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={6}
        className={cn('animate-fade-in z-50 min-w-[190px] rounded-lg border border-border bg-surface p-1 shadow-pop', className)}
      >
        {children}
      </M.Content>
    </M.Portal>
  );
}

export function MenuItem({ children, onSelect, danger, disabled, icon }: { children: React.ReactNode; onSelect?: () => void; danger?: boolean; disabled?: boolean; icon?: React.ReactNode }) {
  return (
    <M.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-none data-[disabled]:cursor-not-allowed data-[highlighted]:bg-surface-muted data-[disabled]:opacity-50',
        danger ? 'text-danger' : 'text-ink',
      )}
    >
      {icon ? <span className="text-ink-muted [&>svg]:size-4">{icon}</span> : null}
      {children}
    </M.Item>
  );
}

export const MenuSeparator = () => <M.Separator className="my-1 h-px bg-border" />;
export const MenuLabel = ({ children }: { children: React.ReactNode }) => <M.Label className="px-2.5 py-1.5 text-2xs font-medium uppercase text-ink-subtle">{children}</M.Label>;
