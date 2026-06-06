import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-[#1E293B] text-[#94A3B8] border border-[#334155]',
        primary: 'bg-[#4B6BF1]/20 text-[#4B6BF1]',
        success: 'bg-[#059669]/20 text-[#059669]',
        danger:  'bg-[#DC2626]/20 text-[#DC2626]',
        warning: 'bg-[#D97706]/20 text-[#D97706]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
