import { useEffect, useRef } from "react";

const COLOURS = ["#f5c84c", "#ff3d8b", "#ff8a2b", "#2fd39a", "#a35cff", "#ffffff"];

interface P { x: number; y: number; vx: number; vy: number; life: number; c: string; }

/** Canvas fireworks. `auto` launches bursts continuously; `burstKey` changes trigger a single burst. */
export function Fireworks({ auto = true, intensity = 1, className = "" }: { auto?: boolean; intensity?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let parts: P[] = [];
    let raf = 0, last = 0, visible = true;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width * devicePixelRatio; canvas.height = r.height * devicePixelRatio;
    };
    resize();
    const burst = (x: number, y: number) => {
      const c = COLOURS[Math.floor(Math.random() * COLOURS.length)] ?? "#f5c84c";
      const n = Math.floor(50 * intensity);
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n, s = (Math.random() * 2 + 1.5) * devicePixelRatio;
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, c });
      }
    };
    if (reduce) {
      // calm static sparkles
      for (let i = 0; i < 3; i++) burst(canvas.width * (0.25 + i * 0.25), canvas.height * 0.35);
      parts.forEach((p) => { p.x += p.vx * 25; p.y += p.vy * 25; });
      parts.forEach((p) => { ctx.fillStyle = p.c; ctx.globalAlpha = 0.5; ctx.fillRect(p.x, p.y, 2, 2); });
      return;
    }
    const io = new IntersectionObserver(([e]) => { visible = e?.isIntersecting ?? true; });
    io.observe(canvas);
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (!visible) return;
      if (auto && t - last > 700 / intensity) {
        last = t;
        burst(canvas.width * (0.1 + Math.random() * 0.8), canvas.height * (0.1 + Math.random() * 0.45));
      }
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "lighter";
      parts = parts.filter((p) => p.life > 0);
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.035 * devicePixelRatio; p.vx *= 0.985; p.vy *= 0.985; p.life -= 0.012;
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.6 * devicePixelRatio, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    if (!auto) burst(canvas.width / 2, canvas.height / 2);
    raf = requestAnimationFrame(tick);
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener("resize", resize); };
  }, [auto, intensity]);
  return <canvas ref={ref} aria-hidden className={`pointer-events-none h-full w-full ${className}`} />;
}

/** Small sparkle burst positioned over a button. */
export function SparkBurst({ trigger }: { trigger: number }) {
  if (!trigger) return null;
  return (
    <span key={trigger} aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full"
            style={{
              background: COLOURS[i % COLOURS.length],
              animation: "spark 600ms ease-out forwards",
              ["--dx" as string]: `${Math.cos(a) * 46}px`,
              ["--dy" as string]: `${Math.sin(a) * 46}px`,
            }}
          />
        );
      })}
      <style>{`@keyframes spark{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(.2);opacity:0}}`}</style>
    </span>
  );
}
