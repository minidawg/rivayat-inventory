'use client'

import { useEffect } from 'react'

export function ThemeBootstrap() {
  useEffect(() => {
    const saved = localStorage.getItem('rivayat-theme')
    if (saved === 'amethyst') {
      document.documentElement.classList.add('theme-amethyst')
    } else {
      document.documentElement.classList.remove('theme-amethyst')
    }
  }, [])
  return null
}
