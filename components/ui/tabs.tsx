"use client"

import * as React from "react"

// Creamos un contexto para que las pestañas sepan cuál está activa
const TabsContext = React.createContext<{
  activeTab: string;
  setActiveTab: (value: string) => void;
} | null>(null)

export function Tabs({ defaultValue, children, className = "" }: any) {
  const [activeTab, setActiveTab] = React.useState(defaultValue)
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({ children, className = "" }: any) {
  return (
    <div className={`inline-flex items-center justify-center rounded-lg bg-slate-100 p-1 text-slate-500 ${className}`}>
      {children}
    </div>
  )
}

export function TabsTrigger({ value, children, className = "" }: any) {
  const context = React.useContext(TabsContext)
  if (!context) return null
  const { activeTab, setActiveTab } = context
  const isActive = activeTab === value
  
  return (
    <button
      onClick={() => setActiveTab(value)}
      className={`inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 ${className}`}
      data-state={isActive ? "active" : "inactive"}
    >
      {children}
    </button>
  )
}

export function TabsContent({ value, children, className = "" }: any) {
  const context = React.useContext(TabsContext)
  if (!context) return null
  if (context.activeTab !== value) return null
  
  return (
    <div className={`mt-2 animate-in fade-in duration-500 ${className}`}>
      {children}
    </div>
  )
}