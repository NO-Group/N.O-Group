import type { CSSProperties, ReactNode } from 'react';

interface GradientBorderProps {
  /** When true, the 6-stop N.O Group spectrum ring + glow halo renders. */
  active: boolean;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  style?: CSSProperties;
  onClick?: () => void;
  role?: string;
  tabIndex?: number;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

/**
 * The N.O Group gradient-ring primitive. Active cards gain the official
 * 6-stop spectrum border (animated sweep) and tri-stop glow halo; idle
 * cards sit on the structural `#161B22` border over the `#090C10`
 * elevated surface.
 */
export function GradientBorder({
  active,
  children,
  className = '',
  innerClassName = '',
  style,
  onClick,
  role,
  tabIndex,
  onKeyDown,
}: GradientBorderProps): JSX.Element {
  if (!active) {
    return (
      <div
        className={`gb gb--idle ${className}`}
        style={style}
        onClick={onClick}
        role={role}
        tabIndex={tabIndex}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    );
  }
  return (
    <div
      className={`gb gb--active ${className}`}
      style={style}
      onClick={onClick}
      role={role}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
    >
      <div className={`gb__inner ${innerClassName}`}>{children}</div>
    </div>
  );
}
