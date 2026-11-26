import { cn } from '@/lib/utils'

const variants = {
  default: 'bg-[var(--primary-container)] text-[var(--on-primary-container)]',
  secondary: 'bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]',
  tertiary: 'bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)]',
  outline: 'border border-[var(--outline-variant)] text-[var(--on-surface-variant)]',
  success: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30',
  danger: 'bg-[var(--error-container)] text-[var(--on-error-container)]',
}

export function Badge({ children, variant = 'default', className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
