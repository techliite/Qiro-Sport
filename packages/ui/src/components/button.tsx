import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4B6BF1] disabled:pointer-events-none disabled:opacity-40 active:scale-95',
  {
    variants: {
      variant: {
        primary: 'bg-[#4B6BF1] text-white hover:bg-[#3a57d4]',
        accent:  'bg-[#7C3AED] text-white hover:bg-[#6d31d4]',
        outline: 'border border-[#334155] bg-transparent text-[#F1F5F9] hover:bg-[#1E293B]',
        ghost:   'bg-transparent text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#F1F5F9]',
        danger:  'bg-[#DC2626] text-white hover:bg-[#b91c1c]',
        success: 'bg-[#059669] text-white hover:bg-[#047857]',
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
