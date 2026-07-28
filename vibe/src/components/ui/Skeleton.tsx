import { cn } from '../../utils/cn';

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn(
    'rounded-xl bg-gradient-to-r from-white/5 via-white/10 to-white/5',
    'bg-[length:200%_100%] animate-pulse',
    className,
  )} />
);

export const SongCardSkeleton = () => (
  <div className="bg-[#111120] border border-white/7 rounded-2xl overflow-hidden">
    <Skeleton className="aspect-video rounded-none" />
    <div className="p-4 space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <div className="flex items-center gap-2 pt-2">
        <Skeleton className="h-7 w-7 rounded-full" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16 ml-auto" />
      </div>
    </div>
  </div>
);