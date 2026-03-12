"use client"

import * as React from "react"

type TabsContextType = {
  activeTab: string
  setActiveTab: (value: string) => void
}

const TabsContext = React.createContext<TabsContextType | null>(null)

type TabsProps = {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  className?: string
}

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  children,
  className = "",
}: TabsProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "")

  const isControlled = value !== undefined
  const activeTab = isControlled ? value : internalValue

  const setActiveTab = React.useCallback(
    (nextValue: string) => {
      if (!isControlled) {
        setInternalValue(nextValue)
      }
      onValueChange?.(nextValue)
    },
    [isControlled, onValueChange]
  )

  React.useEffect(() => {
    if (!isControlled && defaultValue) {
      setInternalValue(defaultValue)
    }
  }, [defaultValue, isControlled])

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

type TabsListProps = {
  children: React.ReactNode
  className?: string
}

export function TabsList({ children, className = "" }: TabsListProps) {
  return (
    <div
      className={`inline-flex items-center justify-center rounded-lg bg-slate-100 p-1 text-slate-500 ${className}`}
    >
      {children}
    </div>
  )
}

type TabsTriggerProps = {
  value: string
  children: React.ReactNode
  className?: string
}

export function TabsTrigger({
  value,
  children,
  className = "",
}: TabsTriggerProps) {
  const context = React.useContext(TabsContext)
  if (!context) return null

  const isActive = context.activeTab === value

  return (
    <button
      type="button"
      onClick={() => context.setActiveTab(value)}
      className={`inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 ${className}`}
      data-state={isActive ? "active" : "inactive"}
    >
      {children}
    </button>
  )
}

type TabsContentProps = {
  value: string
  children: React.ReactNode
  className?: string
}

export function TabsContent({
  value,
  children,
  className = "",
}: TabsContentProps) {
  const context = React.useContext(TabsContext)
  if (!context) return null
  if (context.activeTab !== value) return null

  return <div className={`mt-2 ${className}`}>{children}</div>
}