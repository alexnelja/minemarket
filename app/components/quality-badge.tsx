interface QualityBadgeProps {
  label: string;
  variant: 'green' | 'blue' | 'amber' | 'red' | 'gray';
}

const VARIANTS = {
  green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  red: 'bg-red-500/10 text-red-400 border-red-500/20',
  gray: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

export function QualityBadge({ label, variant }: QualityBadgeProps) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${VARIANTS[variant]}`}>
      {label}
    </span>
  );
}
