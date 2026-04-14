import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton-shimmer rounded-xl h-4', className)} {...props} />;
}

export { Skeleton };
