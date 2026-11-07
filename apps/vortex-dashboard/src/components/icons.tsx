/** Minimal inline SVG icon set — stroke style, currentColor. */
import type { CSSProperties, ReactNode } from 'react';

type IconProps = { className?: string; style?: CSSProperties };

function base(props: IconProps, children: ReactNode): JSX.Element {
  return (
    <svg
      className={props.className}
      style={props.style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconOverview = (p: IconProps) =>
  base(p, <>
    <rect x="3" y="3" width="8" height="8" rx="2" />
    <rect x="13" y="3" width="8" height="5" rx="2" />
    <rect x="13" y="10" width="8" height="11" rx="2" />
    <rect x="3" y="13" width="8" height="8" rx="2" />
  </>);

export const IconStorage = (p: IconProps) =>
  base(p, <>
    <ellipse cx="12" cy="5.5" rx="8" ry="2.8" />
    <path d="M4 5.5V12c0 1.55 3.58 2.8 8 2.8s8-1.25 8-2.8V5.5" />
    <path d="M4 12v6.5c0 1.55 3.58 2.8 8 2.8s8-1.25 8-2.8V12" />
  </>);

export const IconMedia = (p: IconProps) =>
  base(p, <>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m21 16-4.5-4.5a1.5 1.5 0 0 0-2.1 0L6 20" />
  </>);

export const IconWebhook = (p: IconProps) =>
  base(p, <>
    <path d="M10.5 5.5a4.5 4.5 0 0 1 8.55 2" />
    <path d="M20 11.5a4.5 4.5 0 0 1-6.32 6.18l-2.98-2.98" />
    <path d="M6.9 9.3a4.5 4.5 0 0 0-2.4 8.03" />
    <circle cx="7.5" cy="6.5" r="2.2" />
    <circle cx="16.6" cy="18" r="2.2" />
    <circle cx="5.3" cy="16.8" r="2.2" />
  </>);

export const IconSettings = (p: IconProps) =>
  base(p, <>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.64 8.9a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.88.34h.11A1.7 1.7 0 0 0 10.12 3V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.88v.11a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.01Z" />
  </>);

export const IconUpload = (p: IconProps) =>
  base(p, <>
    <path d="M12 16V4" />
    <path d="m6 10 6-6 6 6" />
    <path d="M4 20h16" />
  </>);

export const IconTrash = (p: IconProps) =>
  base(p, <>
    <path d="M4 7h16" />
    <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="M6.5 7 7.4 20a1 1 0 0 0 1 .9h7.2a1 1 0 0 0 1-.9L17.5 7" />
    <path d="M10 11v6M14 11v6" />
  </>);

export const IconBolt = (p: IconProps) =>
  base(p, <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H13L13 2Z" />);

export const IconShield = (p: IconProps) =>
  base(p, <>
    <path d="M12 3 4.5 6v5.5c0 4.7 3.2 7.9 7.5 9.5 4.3-1.6 7.5-4.8 7.5-9.5V6L12 3Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </>);

export const IconLayers = (p: IconProps) =>
  base(p, <>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </>);

export const IconRefresh = (p: IconProps) =>
  base(p, <>
    <path d="M20 12a8 8 0 1 1-2.34-5.66" />
    <path d="M20 4v5h-5" />
  </>);

export const IconLink = (p: IconProps) =>
  base(p, <>
    <path d="M10 14a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L10.9 6" />
    <path d="M14 10a5 5 0 0 0-7.07 0L4.8 12.12a5 5 0 0 0 7.07 7.07L13.1 18" />
  </>);

export const IconCloud = (p: IconProps) =>
  base(p, <path d="M17.5 19a4.5 4.5 0 1 0-.42-8.98 6 6 0 1 0-10.6 3.74A4 4 0 0 0 6 19.5Z" />);

export const IconDisk = (p: IconProps) =>
  base(p, <>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <circle cx="12" cy="10" r="3" />
    <path d="M12 16v2" />
  </>);
