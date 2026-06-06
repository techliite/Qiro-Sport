import * as React from 'react'
import { cn } from '../lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  prefix?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, prefix, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] font-mono text-sm pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          type={type}
          className={cn(
            'flex h-10 w-full rounded-lg border border-[#334155] bg-[#0F172A] px-3 py-2 text-sm text-[#F1F5F9] placeholder:text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#4B6BF1] disabled:cursor-not-allowed disabled:opacity-50',
            prefix && 'pl-8',
            className,
          )}
          ref={ref}
          {...props}
        />
      </div>
    )
  },
)
Input.displayName = 'Input'
