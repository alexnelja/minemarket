import type { DealStatus } from '@/lib/types';

const STEPS = [
  { key: 'interest', label: 'Interest' },
  { key: 'negotiate', label: 'Negotiate' },
  { key: 'escrow', label: 'Escrow' },
  { key: 'shipping', label: 'Shipping' },
  { key: 'complete', label: 'Complete' },
];

// Map deal statuses to step index
const STATUS_TO_STEP: Record<DealStatus, number> = {
  interest: 0, first_accept: 0,
  negotiation: 1, second_accept: 1,
  escrow_held: 2,
  loading: 3, in_transit: 3,
  delivered: 4, escrow_released: 4, completed: 4,
  disputed: -1, cancelled: -1,
};

// Contextual messages for each status
const STATUS_MESSAGES: Record<DealStatus, string> = {
  interest: 'Waiting for the seller to acknowledge your interest.',
  first_accept: 'Seller acknowledged. Move to negotiation when ready.',
  negotiation: 'Discuss terms with your counterparty. Agree on specs, price, and delivery.',
  second_accept: 'Both parties agreed. Buyer must deposit escrow funds.',
  escrow_held: 'Escrow secured. Seller will begin loading material.',
  loading: 'Material is being loaded at the mine or port.',
  in_transit: 'Shipment is on the water. Track progress below.',
  delivered: 'Material received. Review specs and confirm to release escrow.',
  escrow_released: 'Payment sent to seller. Rate your experience below.',
  completed: 'Deal completed successfully.',
  disputed: 'This deal is disputed. Escrow is frozen pending resolution.',
  cancelled: 'This deal was cancelled.',
};

interface DealProgressProps {
  status: DealStatus;
  isBuyer: boolean;
}

export function DealProgress({ status, isBuyer }: DealProgressProps) {
  const currentStep = STATUS_TO_STEP[status];
  const message = STATUS_MESSAGES[status];
  const isTerminal = status === 'disputed' || status === 'cancelled';

  // Suppress unused variable lint — isBuyer reserved for future role-specific messaging
  void isBuyer;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      {/* Step bar */}
      <div className="flex items-center mb-4">
        {STEPS.map((step, i) => (
          <div key={step.key} className="flex items-center flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 ${
              isTerminal ? 'border-red-500/30 bg-red-500/10 text-red-400'
              : i < currentStep ? 'border-emerald-500 bg-emerald-500 text-black'
              : i === currentStep ? 'border-amber-500 bg-amber-500/20 text-amber-400'
              : 'border-gray-700 bg-gray-900 text-gray-600'
            }`}>
              {i < currentStep && !isTerminal ? '\u2713' : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 ${
                i < currentStep && !isTerminal ? 'bg-emerald-500' : 'bg-gray-700'
              }`} />
            )}
          </div>
        ))}
      </div>
      {/* Labels */}
      <div className="flex mb-4">
        {STEPS.map((step, i) => (
          <div key={step.key} className="flex-1 text-center">
            <span className={`text-[10px] ${
              i === currentStep ? 'text-amber-400 font-medium' : 'text-gray-600'
            }`}>{step.label}</span>
          </div>
        ))}
      </div>
      {/* Context message */}
      <p className="text-xs text-gray-400 text-center bg-gray-950 rounded-lg py-2 px-3">
        {message}
      </p>
    </div>
  );
}
