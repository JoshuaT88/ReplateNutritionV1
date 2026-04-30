import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white shadow-sm hover:bg-primary-deep active:scale-[0.98]',
        destructive: 'bg-accent-danger text-white shadow-sm hover:bg-accent-danger/90',
        outline: 'border border-card-border dark:border-[#374151] bg-white dark:bg-[#1F2937] hover:bg-slate-50 dark:hover:bg-[#283447] text-foreground',
        secondary: 'bg-slate-100 dark:bg-[#283447] text-foreground hover:bg-slate-200 dark:hover:bg-[#374151]',
        ghost: 'hover:bg-slate-100 dark:hover:bg-[#283447] text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        success: 'bg-accent-success text-white shadow-sm hover:bg-accent-success/90',
        warning: 'bg-accent-warning text-white shadow-sm hover:bg-accent-warning/90',
      },
      size: {
        default: 'h-10 px-5 rounded-xl',
        sm: 'h-8 px-3 text-xs rounded-lg',
        lg: 'h-12 px-8 text-base rounded-xl',
        icon: 'h-10 w-10 rounded-xl',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = 'Button';

export { Button, buttonVariants };
