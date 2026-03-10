"use client"

import * as React from "react"

interface ProgressProps {
  value: number
  className?: string
}

export function Progress({ value, className = "" }: ProgressProps) {
  return (
    <div className={`relative h-2 w-100 overflow-hidden rounded-full bg-slate-100 ${className}`}>
      <div
        className="h-full w-full flex-1 bg-orange-500 transition-all duration-500 ease-in-out"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </div>
  )
}