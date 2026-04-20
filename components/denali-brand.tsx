type DenaliBrandProps = {
  className?: string;
};

export default function DenaliBrand({ className = '' }: DenaliBrandProps) {
  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      <img
        src="/denali-logo.png"
        alt="Denali"
        className="h-16 w-auto object-contain"
      />

      <div className="mt-2 leading-tight">
        <div className="text-[2rem] font-semibold tracking-[0.35em] text-slate-950">
          DENALI
        </div>

        <div className="mt-1 text-sm font-medium tracking-[0.18em] text-slate-600">
          Logistics – SEA991
        </div>
      </div>

      <div className="mt-3 w-full max-w-[220px] border-t border-slate-400" />

      <div className="mt-3 text-sm text-slate-600">
        Powered by <span className="font-semibold tracking-wide">SCCT</span>
        <sup className="ml-0.5 text-[0.6em] align-super">TM</sup>
      </div>
    </div>
  );
}