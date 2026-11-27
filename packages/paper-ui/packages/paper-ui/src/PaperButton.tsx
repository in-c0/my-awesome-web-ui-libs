import { type ButtonHTMLAttributes, forwardRef } from 'react';

export interface PaperButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'ink' | 'quiet' | 'outline';
}

export const PaperButton = forwardRef<HTMLButtonElement, PaperButtonProps>(function PaperButton(
  { variant = 'quiet', type = 'button', className = '', ...props },
  ref,
) {
  return (
    <button {...props} ref={ref} type={type} className={['pui-button', 'pui-button--' + variant, className].filter(Boolean).join(' ')} />
  );
});
