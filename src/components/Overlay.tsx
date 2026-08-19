import clsx from 'clsx';
import type { ReactNode } from 'react';

export function Overlay({
  children,
  className,
  zClassName = 'z-50',
}: {
  children: ReactNode;
  className?: string;
  zClassName?: string;
}) {
  return (
    <div className={clsx('fixed inset-0 flex items-center justify-center bg-black/20 p-4 dark:bg-black/55', zClassName, className)}>
      {children}
    </div>
  );
}
