import { cn } from '../../utils/cn';

interface AvatarProps {
  src?:       string | null;
  name?:      string;
  size?:      'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizes = {
  xs: 'w-6 h-6 text-[10px]', sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',   lg: 'w-12 h-12 text-base',
  xl: 'w-20 h-20 text-2xl',
};

const gradients = [
  'from-purple-500 to-pink-500',  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-500', 'from-orange-500 to-red-500',
  'from-indigo-500 to-purple-500','from-rose-500 to-pink-500',
];

const getGradient = (n?: string) => gradients[(n?.charCodeAt(0) ?? 0) % gradients.length];
const getInitials = (n?: string) =>
  n ? n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : '?';

export const Avatar = ({ src, name, size = 'md', className }: AvatarProps) => {
  if (src) return (
    <img src={src} alt={name || 'User'}
      className={cn('rounded-full object-cover ring-2 ring-white/10 flex-shrink-0', sizes[size], className)} />
  );
  return (
    <div className={cn(
      'rounded-full flex items-center justify-center font-semibold text-white',
      'ring-2 ring-white/10 flex-shrink-0 bg-gradient-to-br',
      getGradient(name), sizes[size], className,
    )}>
      {getInitials(name)}
    </div>
  );
};  