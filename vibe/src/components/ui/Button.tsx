import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'glass' | 'danger';
type Size    = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:   Variant;
  size?:      Size;
  isLoading?: boolean;
  leftIcon?:  ReactNode;
  rightIcon?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:   'bg-gradient-to-r from-purple-700 to-purple-500 text-white hover:brightness-110 shadow-lg shadow-purple-900/40',
  secondary: 'bg-pink-500/15 text-pink-400 border border-pink-500/30 hover:bg-pink-500/25',
  ghost:     'text-slate-400 hover:bg-white/5 hover:text-slate-100',
  glass:     'bg-white/5 backdrop-blur-xl border border-white/10 text-slate-100 hover:bg-white/10',
  danger:    'bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25',
};

const sizes: Record<Size, string> = {
  sm:   'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md:   'h-10 px-4 text-sm gap-2 rounded-xl',
  lg:   'h-12 px-6 text-base gap-2 rounded-xl',
  icon: 'h-10 w-10 rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', isLoading, leftIcon, rightIcon,
     className, children, disabled, ...props }, ref) => (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.96 }}
      whileHover={{ scale: disabled || isLoading ? 1 : 1.02 }}
      className={cn(
        'relative inline-flex items-center justify-center font-medium transition-all duration-200',
        'outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer',
        variants[variant], sizes[size], className,
      )}
      disabled={disabled || isLoading}
      {...(props as React.ComponentProps<typeof motion.button>)}
    >
      {isLoading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        </span>
      )}
      <span className={cn('flex items-center gap-[inherit]', isLoading && 'opacity-0')}>
        {leftIcon}{children}{rightIcon}
      </span>
    </motion.button>
  ),
);
Button.displayName = 'Button';