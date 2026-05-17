'use client'

import { useEffect } from 'react'

export function ThemeBootstrap() {
  useEffect(() => {
    const html = document.documentElement
    const saved = localStorage.getItem('rivayat-theme')
    if (saved === 'amethyst') {
      html.classList.add('theme-amethyst', 'dark')
    } else {
      html.classList.remove('theme-amethyst', 'dark')
    }
  }, [])
  return null
}
