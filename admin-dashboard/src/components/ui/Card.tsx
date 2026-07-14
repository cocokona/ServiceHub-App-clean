import { cn } from '../../lib/utils';

interface CardProps {
  title?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

export default function Card({ title, action, className, bodyClassName, children }: CardProps) {
  return (
    <section
      className={cn(
        'flex flex-col rounded-lg border border-outline-variant bg-surface shadow-card',
        className,
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-outline-variant px-md py-sm">
          {title && <h3 className="font-headline-sm text-headline-sm text-on-surface">{title}</h3>}
          {action}
        </div>
      )}
      <div className={cn('p-md', bodyClassName)}>{children}</div>
    </section>
  );
}
