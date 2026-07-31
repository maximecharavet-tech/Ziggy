import { forwardRef, ButtonHTMLAttributes, ComponentProps } from 'react';
import { Link } from '@/i18n/navigation';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

/** Href accepted by the localized next-intl Link (typed routes). */
type LinkHref = ComponentProps<typeof Link>['href'];

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** When present the button renders as a localized `Link` instead of a `<button>`. */
  href?: LinkHref;
}

const variantClasses: Record<Variant, string> = {
  primary: 'gradient-green-cta text-white shadow-[0_2px_8px_rgba(34,197,94,0.3)] hover:shadow-[0_4px_16px_rgba(34,197,94,0.4)]',
  secondary: 'bg-bg-card text-text-body border border-border hover:border-green/40',
  ghost: 'text-text-muted hover:text-text-body hover:bg-border/30',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
};

const baseClasses =
  'inline-flex items-center justify-center rounded-full font-bold transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', children, href, ...props }, ref) => {
    const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

    if (href !== undefined) {
      // Only forward props that make sense on an anchor.
      const { onClick, 'aria-label': ariaLabel, id, title, tabIndex } = props;
      return (
        <Link
          href={href}
          className={classes}
          onClick={onClick as ComponentProps<typeof Link>['onClick']}
          aria-label={ariaLabel}
          id={id}
          title={title}
          tabIndex={tabIndex}
        >
          {children}
        </Link>
      );
    }

    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
