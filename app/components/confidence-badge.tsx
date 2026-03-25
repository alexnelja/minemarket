interface ConfidenceBadgeProps {
  confidence: 'high' | 'medium' | 'low' | string;
}

const CONFIDENCE_STYLES = {
  high: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  low: 'bg-red-500/10 text-red-400 border-red-500/20',
};

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const style = CONFIDENCE_STYLES[confidence as keyof typeof CONFIDENCE_STYLES] ?? CONFIDENCE_STYLES.low;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${style}`}>
      {confidence}
    </span>
  );
}
