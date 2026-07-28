import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog = ({
  open, title, message,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  danger       = true,
  onConfirm, onCancel,
}: Props) => (
  <AnimatePresence>
    {open && (
      <>
        {/* Backdrop */}
        <motion.div
          key="confirm-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onCancel}
          className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
        />

        {/* Dialog */}
        <motion.div
          key="confirm-dialog"
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: 1,    y: 0  }}
          exit={{   opacity: 0, scale: 0.94, y: 8  }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[91] flex items-center justify-center px-4 pointer-events-none"
        >
          <div className="pointer-events-auto w-full max-w-[340px] bg-[#18181c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

            {/* Icon + header */}
            <div className="px-5 pt-5 pb-4 flex items-start gap-3.5">
              <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${
                danger ? 'bg-red-500/12' : 'bg-violet-500/12'
              }`}>
                <AlertTriangle className={`w-4.5 h-4.5 ${danger ? 'text-red-400' : 'text-violet-400'}`} />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-[14px] font-semibold text-white leading-snug">{title}</p>
                <p className="text-[12.5px] text-zinc-500 mt-1 leading-relaxed">{message}</p>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-white/[0.06] mx-5" />

            {/* Buttons */}
            <div className="flex items-center gap-2.5 px-5 py-4">
              <button
                onClick={onCancel}
                style={{ WebkitTapHighlightColor: 'transparent' }}
                className="flex-1 py-2.5 rounded-xl bg-white/6 border border-white/[0.08] text-[13px] font-medium text-zinc-300 hover:bg-white/10 active:bg-white/14 transition-all"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                style={{ WebkitTapHighlightColor: 'transparent' }}
                className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all ${
                  danger
                    ? 'bg-red-600 hover:bg-red-500 active:bg-red-700 shadow-lg shadow-red-600/20'
                    : 'bg-violet-600 hover:bg-violet-500 active:bg-violet-700 shadow-lg shadow-violet-600/20'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);