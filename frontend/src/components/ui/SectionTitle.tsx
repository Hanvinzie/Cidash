import type { ReactNode } from 'react';

interface SectionTitleProps {
  children: ReactNode;
  action?: ReactNode;
}

export default function SectionTitle({ children, action }: SectionTitleProps) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-base font-bold">{children}</h2>
      {action}
    </div>
  );
}
