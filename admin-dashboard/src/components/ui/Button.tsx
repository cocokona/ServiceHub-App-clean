import { cn } from '../../lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary-container text-white hover:bg-primary',
  secondary: 'border border-outline-variant bg-surface text-on-surface hover:bg-surface-container-low',
  ghost: 'text-on-surface-variant hover:bg-surface-container-high',
  danger: 'bg-error text-white hover:bg-error/90',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-md text-label-md',
  md: 'h-9 px-lg text-body-sm',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-xs rounded font-label-md text-label-md transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
