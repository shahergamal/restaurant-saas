import Link from 'next/link';
import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'soft';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white shadow-accent hover:bg-accent-hover disabled:bg-accent/50 disabled:shadow-none',
  secondary: 'border border-accent bg-surface text-accent hover:bg-accent-soft2',
  outline: 'border border-border bg-surface text-ink hover:bg-surface-muted',
  ghost: 'text-ink-muted hover:bg-surface-muted hover:text-ink',
  danger: 'bg-danger text-white hover:bg-danger/90',
  soft: 'bg-accent-soft text-accent hover:bg-accent-soft/70',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 gap-1.5 rounded px-3 text-xs',
  md: 'h-10 gap-2 rounded-md px-4 text-sm',
  lg: 'h-11 gap-2 rounded-md px-5 text-base',
  icon: 'size-9 rounded-md',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn('inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium transition-colors duration-fast', variants[variant], sizes[size], className);
}

export function ButtonLink({ href, variant, size, className, children }: { href: string; variant?: Variant; size?: Size; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
});
