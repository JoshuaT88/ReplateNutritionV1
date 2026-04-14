import { cn, getInitials, getAvatarGradient } from '@/lib/utils';

interface UserAvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
};

export function UserAvatar({ name, imageUrl, size = 'md', className }: UserAvatarProps) {
  const gradient = getAvatarGradient(name);

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={cn('rounded-xl object-cover', sizes[size], className)}
      />
    );
  }

  return (
    <div className={cn(
      'flex items-center justify-center rounded-xl bg-gradient-to-br font-bold text-white', 
      gradient, sizes[size], className
    )}>
      {getInitials(name)}
    </div>
  );
}
