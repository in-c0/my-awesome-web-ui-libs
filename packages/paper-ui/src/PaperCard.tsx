import type { HTMLAttributes, ReactNode } from 'react';

export interface PaperCardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  interactive?: boolean;
  raised?: boolean;
}

/** No per-card GPU contexts. Deliberately tactile only through inexpensive CSS transforms. */
export function PaperCard({ children, interactive = false, raised = false, className = '', ...props }: PaperCardProps) {
  return (
    <article
      {...props}
      className={['pui-card', interactive && 'pui-card--interactive', raised && 'pui-card--raised', className].filter(Boolean).join(' ')}
    >
      {children}
    </article>
  );
}
