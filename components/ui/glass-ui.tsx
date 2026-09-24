import React from "react";

export interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

export function GlassCard({ children, className = "", glow = false }: GlassCardProps) {
  return (
    <div
      className={`relative backdrop-blur-xl bg-white/10 dark:bg-slate-900/40 border border-white/20 dark:border-slate-700/50 rounded-2xl p-6 shadow-2xl transition-all duration-300 hover:shadow-indigo-500/10 ${
        glow ? "shadow-indigo-500/20 border-indigo-500/30" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export interface QuickReplyOption {
  id: string;
  title: string;
  payload?: string;
}

export interface QuickRepliesProps {
  options: QuickReplyOption[];
  onSelect: (option: QuickReplyOption) => void;
  disabled?: boolean;
}

export function QuickReplies({ options, onSelect, disabled = false }: QuickRepliesProps) {
  return (
    <div className="flex flex-wrap gap-2.5 my-3">
      {options.map((opt) => (
        <button
          key={opt.id}
          disabled={disabled}
          onClick={() => onSelect(opt)}
          className="px-4 py-2 text-sm font-medium text-indigo-200 bg-indigo-950/60 hover:bg-indigo-600 hover:text-white border border-indigo-500/30 hover:border-indigo-400 rounded-full transition-all duration-200 shadow-sm backdrop-blur-md active:scale-95 disabled:opacity-50"
        >
          {opt.title}
        </button>
      ))}
    </div>
  );
}

export interface CarouselCard {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  buttonLabel?: string;
  buttonUrl?: string;
}

export function GlassCarousel({ cards }: { cards: CarouselCard[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 pt-2 scrollbar-thin scrollbar-thumb-indigo-500/20">
      {cards.map((card) => (
        <GlassCard key={card.id} className="min-w-[240px] max-w-[280px] flex-shrink-0 flex flex-col justify-between">
          {card.imageUrl && (
            <img
              src={card.imageUrl}
              alt={card.title}
              className="w-full h-36 object-cover rounded-xl mb-3 border border-white/10"
            />
          )}
          <div>
            <h4 className="font-semibold text-base text-slate-100">{card.title}</h4>
            {card.subtitle && <p className="text-xs text-slate-400 mt-1">{card.subtitle}</p>}
          </div>
          {card.buttonLabel && (
            <a
              href={card.buttonUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 w-full block text-center py-2 text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 rounded-xl shadow-lg shadow-indigo-500/25 transition-all"
            >
              {card.buttonLabel}
            </a>
          )}
        </GlassCard>
      ))}
    </div>
  );
}
