import { createContext, useContext, useMemo, useState } from 'react'

const DocumentContext = createContext(null)

export function DocumentProvider({ children }) {
  const [document, setDocument] = useState(null)

  const value = useMemo(
    () => ({ document, setDocument }),
    [document],
  )

  return (
    <DocumentContext.Provider value={value}>{children}</DocumentContext.Provider>
  )
}

export function useDocument() {
  const context = useContext(DocumentContext)
  if (!context) {
    throw new Error('useDocument must be used within DocumentProvider')
  }
  return context
}
