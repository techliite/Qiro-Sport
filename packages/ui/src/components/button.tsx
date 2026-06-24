import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] disabled:pointer-events-none disabled:opacity-40 active:scale-95',
  {
    variants: {
      variant: {
        primary: 'bg-[#0066FF] text-white hover:bg-[#0052CC] shadow-[0_0_16px_rgba(0,102,255,0.35)] hover:shadow-[0_0_24px_rgba(0,102,255,0.5)]',
        accent:  'bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/30 hover:bg-[#00D4FF]/20 hover:border-[#00D4FF]/60',
        outline: 'border border-[#1A2B4A] bg-transparent text-[#E6F1FF] hover:bg-[#0F1B3D] hover:border-[#0066FF]/40',
        ghost:   'bg-transparent text-[#4D6B9A] hover:bg-[#0F1B3D] hover:text-[#E6F1FF]',
        danger:  'bg-[#EF4444] text-white hover:bg-[#DC2626]',
        success: 'bg-[#00C48C] text-white hover:bg-[#00A876]',
      },
      size: {
        sm:   'h-8  px-3 text-xs',
        md:   'h-10 px-4 text-sm',
        lg:   'h-12 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  },
)
Button.displayName = 'Button'
