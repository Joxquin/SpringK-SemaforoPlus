import { cn } from '@/lib/utils'

const variants = {
  filled: 'bg-[var(--primary)] text-[var(--on-primary)] shadow-sm hover:shadow-md hover:opacity-95',
  tonal: 'bg-[var(--secondary-container)] text-[var(--on-secondary-container)] hover:opacity-90',
  outlined: 'border border-[var(--outline)] text-[var(--primary)] hover:bg-[var(--primary-container)]/30',
  text: 'text-[var(--primary)] hover:bg-[var(--primary-container)]/30',
  elevated: 'bg-[var(--surface-container-low)] text-[var(--primary)] shadow-md hover:shadow-lg',
  danger: 'bg-[var(--error)] text-[var(--on-error)] shadow-sm hover:opacity-95',
}

const sizes = {
  sm: 'h-9 px-4 text-xs',
  md: 'h-11 px-6 text-sm',
  lg: 'h-13 px-8 text-base',
  icon: 'h-10 w-10 p-0',
}

export function Button({
  children,
  variant = 'filled',
  size = 'md',
  className,
  ...props
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
