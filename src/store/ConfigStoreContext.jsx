import { createContext, useContext } from 'react'
import { useConfigStore } from './useConfigStore.js'

const ConfigStoreContext = createContext(useConfigStore)

/**
 * Fournit le store matrice actif (main ou session boutique).
 * @param {{ store: typeof useConfigStore, children: import('react').ReactNode }} props
 */
export function ConfigStoreProvider({ store, children }) {
  return (
    <ConfigStoreContext.Provider value={store}>
      {children}
    </ConfigStoreContext.Provider>
  )
}

/** Hook zustand du store courant (main par défaut). */
export function useActiveConfigStore(selector) {
  const store = useContext(ConfigStoreContext) || useConfigStore
  return store(selector)
}

/** Accès API (.getState, .setState) du store courant. */
export function useActiveConfigStoreApi() {
  return useContext(ConfigStoreContext) || useConfigStore
}
