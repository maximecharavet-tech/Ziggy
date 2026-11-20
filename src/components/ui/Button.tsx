'use client';

import { forwardRef, useCallback, useRef, type ButtonHTMLAttributes, type ComponentProps, type ReactNode, type Ref } from 'react';
import { animate } from 'motion/react';
import { Link } from '@/i18n/navigation';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { Magnetic } from './motion-primitives';
import { useTapRipple } from './fx/TapRipple';
import { fxSound, type FxSound } from './fx/sfx';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

/** Href accepted by the localized next-intl Link (typed routes). */
type LinkHref = ComponentProps<typeof Link>['href'];

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** When present the button renders as a localized `Link` instead of a `<button>`. */
  href?: LinkHref;
  /** Pulled toward the cursor (fine pointers only). For the few big calls to action. */
  magnetic?: boolean;
  /** Sound when pressed (default 'tap'; `false` for none). Respects the mute switch. */
  sound?: FxSound | false;
  /** Squash & stretch and a tap ripple when pressed (default on). */
  juicy?: boolean;
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

// No CSS transition on transform: the press spring writes it every frame.
const baseClasses =
  'relative inline-flex items-center justify-center rounded-full font-bold transition-[box-shadow,background-color,border-color,color,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] cursor-pointer select-none [-webkit-tap-highlight-color:transparent] disabled:opacity-50 disabled:cursor-not-allowed';

/** Press: a quick squash. Release: a bouncy spring that overshoots into a little stretch. */
const SQUASH = { scaleX: 1.05, scaleY: 0.9 };
const SQUASH_SPRING = { type: 'spring', stiffness: 900, damping: 32, mass: 0.6 } as const;
const RELEASE_SPRING = { type: 'spring', stiffness: 560, damping: 13, mass: 0.7 } as const;

function setRef<T>(ref: Ref<T> | undefined, value: T) {
  if (typeof ref === 'function') ref(value);
  else if (ref) (ref as { current: T }).current = value;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', children, href, magnetic = false, sound = 'tap', juicy = true, ...props }, ref) => {
    const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;
    const wrap = (node: ReactNode) => (magnetic ? <Magnetic>{node}</Magnetic> : node);
    const reduced = useReducedMotion();
    const el = useRef<HTMLElement | null>(null);
    const pressed = useRef(false);
    const live = juicy && !props.disabled;
    const { onPointerDown: ripplePointer, ripple, layer } = useTapRipple({ disabled: !live, opacity: variant === 'primary' ? 0.28 : 0.14 });

    const squash = useCallback(() => {
      if (!el.current || reduced) return;
      pressed.current = true;
      animate(el.current, SQUASH, SQUASH_SPRING);
    }, [reduced]);

    const release = useCallback(() => {
      if (!el.current || !pressed.current) return;
      pressed.current = false;
      animate(el.current, { scaleX: 1, scaleY: 1 }, RELEASE_SPRING);
    }, []);

    const juice = {
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        if (!live || e.button !== 0) return;
        squash();
        ripplePointer(e);
      },
      onPointerUp: release,
      onPointerLeave: release,
      onPointerCancel: release,
    };

    const onActivate = (e: React.MouseEvent<HTMLElement>) => {
      if (live) {
        fxSound(sound);
        // A keyboard press (Enter/Space) has no pointer: squash, release and ripple from the middle.
        if (e.detail === 0) {
          squash();
          window.setTimeout(release, 90);
          ripple(e.currentTarget);
        }
      }
    };

    if (href !== undefined) {
      // Only forward props that make sense on an anchor.
      const { onClick, 'aria-label': ariaLabel, id, title, tabIndex } = props;
      return wrap(
        <Link
          ref={(node: HTMLAnchorElement | null) => {
            el.current = node;
          }}
          href={href}
          className={classes}
          onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
            onActivate(e);
            (onClick as ComponentProps<typeof Link>['onClick'])?.(e);
          }}
          {...juice}
          aria-label={ariaLabel}
          id={id}
          title={title}
          tabIndex={tabIndex}
        >
          {children}
          {layer}
        </Link>,
      );
    }

    const { onClick, onPointerDown, onPointerUp, onPointerLeave, onPointerCancel, ...rest } = props;
    return wrap(
      <button
        ref={(node) => {
          el.current = node;
          setRef(ref, node);
        }}
        className={classes}
        {...rest}
        onClick={(e) => {
          onActivate(e);
          onClick?.(e);
        }}
        onPointerDown={(e) => {
          juice.onPointerDown(e);
          onPointerDown?.(e);
        }}
        onPointerUp={(e) => {
          release();
          onPointerUp?.(e);
        }}
        onPointerLeave={(e) => {
          release();
          onPointerLeave?.(e);
        }}
        onPointerCancel={(e) => {
          release();
          onPointerCancel?.(e);
        }}
      >
        {children}
        {layer}
      </button>,
    );
  },
);
Button.displayName = 'Button';
