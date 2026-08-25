import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_LANG,
  LANGS,
  STORAGE_KEY,
  translations,
} from './translations.js'

const I18nContext = createContext(null)

function lookup(dict, path) {
  if (!dict || !path) return undefined
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), dict)
}

function interpolate(str, vars) {
  if (!vars || typeof str !== 'string') return str
  return str.replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] == null ? `{${k}}` : String(vars[k]),
  )
}

function readStoredLang() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (LANGS.includes(raw)) return raw
  } catch {
    /* ignore */
  }
  return DEFAULT_LANG
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(readStoredLang)

  const setLang = useCallback((next) => {
    const value = LANGS.includes(next) ? next : DEFAULT_LANG
    setLangState(value)
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.setAttribute('xml:lang', lang)
  }, [lang])

  const t = useCallback(
    (key, vars) => {
      const found =
        lookup(translations[lang], key) ??
        lookup(translations[DEFAULT_LANG], key)
      if (typeof found !== 'string') {
        return vars?.default ?? key
      }
      return interpolate(found, vars)
    },
    [lang],
  )

  const value = useMemo(
    () => ({ lang, setLang, t, langs: LANGS }),
    [lang, setLang, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return ctx
}

/** Traduit un identifiant de matrice (finition, panneau, tag…). */
export function useTId() {
  const { t } = useI18n()
  return (prefix, id, fallback) => {
    if (id == null || id === '') return fallback ?? ''
    return t(`${prefix}.${id}`, { default: fallback ?? String(id) })
  }
}

/** Nom / pièce catalogue : colonne Nom/Piece en FR, Name/Room en EN. */
export function useCatalogText() {
  const { lang } = useI18n()
  const tId = useTId()
  return {
    name(rowOrFr, en) {
      const fr = rowOrFr && typeof rowOrFr === 'object' ? rowOrFr.name : rowOrFr
      const enName =
        rowOrFr && typeof rowOrFr === 'object' ? rowOrFr.nameEn : en
      if (lang === 'en' && enName) return enName
      return tId('catalog.name', fr, fr)
    },
    category(rowOrFr, en) {
      const fr =
        rowOrFr && typeof rowOrFr === 'object' ? rowOrFr.category : rowOrFr
      const enCat =
        rowOrFr && typeof rowOrFr === 'object' ? rowOrFr.categoryEn : en
      if (lang === 'en' && enCat) return enCat
      return tId('catalog.category', fr, fr)
    },
    desc(row) {
      if (!row || typeof row !== 'object') return ''
      if (lang === 'en') return row.descriptionEn || ''
      return row.descriptionFr || ''
    },
  }
}
