import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-cidash-primary text-cidash-on-primary shadow-sm shadow-cidash-primary/25 hover:bg-cidash-primary-hover',
  secondary: 'bg-inset text-ink hover:bg-line',
  outline: 'border border-cidash-primary/60 text-cidash-primary hover:bg-cidash-primary/10',
  ghost: 'text-muted hover:bg-inset hover:text-ink',
  danger: 'border border-danger/50 text-danger hover:bg-danger/10',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${
        variantClasses[variant]
      } ${sizeClasses[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
