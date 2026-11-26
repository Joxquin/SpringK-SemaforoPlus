import { cn } from '@/lib/utils'

export function Card({ children, className, interactive = false, ...props }) {
  return (
    <div
      className={cn(
        'rounded-[28px] bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)]/50 shadow-sm overflow-hidden transition-all duration-300',
        interactive && 'hover:-translate-y-1 hover:shadow-xl',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
