'use client';

type ForkliftLoaderProps = {
  label?: string;
};

export function ForkliftLoader({ label = 'Loading...' }: ForkliftLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white/90 p-6 text-slate-700 shadow-sm">
      <div className="forklift-loader" aria-hidden="true">
        <div className="forklift-track">
          <div className="crate crate-left" />
          <div className="crate crate-right" />

          <div className="forklift">
            <div className="forklift-mast" />
            <div className="forklift-forks" />
            <div className="forklift-body" />
            <div className="forklift-cab" />
            <div className="wheel wheel-front" />
            <div className="wheel wheel-back" />
            <div className="moving-crate" />
          </div>
        </div>
      </div>

      <div className="text-sm font-semibold">{label}</div>

      <style>{`
        .forklift-loader {
          width: 280px;
          height: 92px;
          position: relative;
          overflow: hidden;
        }

        .forklift-track {
          position: relative;
          width: 100%;
          height: 100%;
          border-bottom: 3px solid #334155;
        }

        .forklift {
          position: absolute;
          left: 0;
          bottom: 8px;
          width: 82px;
          height: 52px;
          animation: forkliftDrive 4.8s linear infinite;
        }

        .forklift-body {
          position: absolute;
          left: 16px;
          bottom: 13px;
          width: 42px;
          height: 24px;
          background: #0f766e;
          border-radius: 5px 5px 3px 3px;
        }

        .forklift-cab {
          position: absolute;
          left: 34px;
          bottom: 34px;
          width: 24px;
          height: 22px;
          border: 4px solid #0f766e;
          border-bottom: none;
          border-radius: 5px 5px 0 0;
        }

        .forklift-mast {
          position: absolute;
          left: 66px;
          bottom: 12px;
          width: 6px;
          height: 46px;
          background: #0f172a;
          border-radius: 2px;
        }

        .forklift-forks {
          position: absolute;
          left: 68px;
          bottom: 13px;
          width: 34px;
          height: 5px;
          background: #0f172a;
          border-radius: 2px;
        }

        .wheel {
          position: absolute;
          bottom: 0;
          width: 15px;
          height: 15px;
          background: #020617;
          border: 3px solid #64748b;
          border-radius: 999px;
          animation: wheelSpin 0.6s linear infinite;
        }

        .wheel-front {
          left: 53px;
        }

        .wheel-back {
          left: 15px;
        }

        .crate,
        .moving-crate {
          width: 24px;
          height: 24px;
          background: #b45309;
          border: 2px solid #78350f;
          box-shadow: inset 0 0 0 2px rgba(255,255,255,0.2);
        }

        .crate-left {
          position: absolute;
          left: 8px;
          bottom: 8px;
          animation: leftCrate 4.8s linear infinite;
        }

        .crate-right {
          position: absolute;
          right: 8px;
          bottom: 8px;
          animation: rightCrate 4.8s linear infinite;
        }

        .moving-crate {
          position: absolute;
          left: 76px;
          bottom: 14px;
          animation: movingCrate 4.8s linear infinite;
        }

        @keyframes forkliftDrive {
          0% { transform: translateX(0) scaleX(1); }
          42% { transform: translateX(176px) scaleX(1); }
          50% { transform: translateX(176px) scaleX(-1); }
          92% { transform: translateX(0) scaleX(-1); }
          100% { transform: translateX(0) scaleX(1); }
        }

        @keyframes movingCrate {
          0%, 8% { opacity: 1; transform: translateY(0); }
          42%, 50% { opacity: 1; transform: translateY(0); }
          54%, 88% { opacity: 0; transform: translateY(10px); }
          92%, 100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes leftCrate {
          0%, 8% { opacity: 0; }
          12%, 88% { opacity: 1; }
          92%, 100% { opacity: 0; }
        }

        @keyframes rightCrate {
          0%, 42% { opacity: 1; }
          46%, 100% { opacity: 0; }
        }

        @keyframes wheelSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default ForkliftLoader;