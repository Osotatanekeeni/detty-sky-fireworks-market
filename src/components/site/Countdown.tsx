import { useEffect, useState } from "react";
import { nextNewYearEve } from "@/lib/services";

export function Countdown({ compact = false }: { compact?: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = now == null ? 0 : Math.max(0, nextNewYearEve() - now);
  const units = [
    ["Days", Math.floor(diff / 864e5)],
    ["Hrs", Math.floor(diff / 36e5) % 24],
    ["Min", Math.floor(diff / 6e4) % 60],
    ["Sec", Math.floor(diff / 1e3) % 60],
  ] as const;
  return (
    <div className={`flex ${compact ? "gap-1.5" : "gap-2 sm:gap-3"}`} role="timer" aria-label="Countdown to New Year's Eve midnight">
      {units.map(([l, v]) => (
        <div key={l} className={`glass rounded-xl text-center ${compact ? "min-w-11 px-1.5 py-1" : "min-w-16 px-3 py-2 sm:min-w-20"}`}>
          <div className={`font-display tabular-nums text-gold-gradient ${compact ? "text-base" : "text-2xl sm:text-4xl"}`}>
            {now == null ? "--" : String(v).padStart(2, "0")}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{l}</div>
        </div>
      ))}
    </div>
  );
}
