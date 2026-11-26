import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext({
  themeMode: 'system',
  resolvedTheme: 'light',
  setThemeMode: () => {},
})

export function ThemeProvider({ children }) {
  const [themeMode, setThemeMode] = useState(() => {
    return localStorage.getItem('sp_theme_mode') || 'system'
  })
  const [systemDark, setSystemDark] = useState(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e) => setSystemDark(e.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const resolvedTheme = themeMode === 'system' ? (systemDark ? 'dark' : 'light') : themeMode

  useEffect(() => {
    localStorage.setItem('sp_theme_mode', themeMode)
    const root = document.documentElement
    if (resolvedTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [themeMode, resolvedTheme])

  return (
    <ThemeContext.Provider value={{ themeMode, resolvedTheme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
