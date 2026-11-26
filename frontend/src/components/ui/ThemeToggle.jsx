import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'

export function ThemeToggle() {
  const { themeMode, setThemeMode } = useTheme()

  const options = [
    { id: 'system', icon: Monitor, label: 'Sistema' },
    { id: 'light', icon: Sun, label: 'Claro' },
    { id: 'dark', icon: Moon, label: 'Oscuro' },
  ]

  return (
    <div className="inline-flex items-center rounded-full bg-[var(--surface-container-high)] p-0.5 sm:p-1 border border-[var(--outline-variant)]/50 shrink-0">
      {options.map((opt) => {
        const Icon = opt.icon
        const active = themeMode === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setThemeMode(opt.id)}
            title={opt.label}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-full p-1.5 sm:px-3 sm:py-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer',
              active
                ? 'bg-[var(--primary)] text-[var(--on-primary)] shadow-sm'
                : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
