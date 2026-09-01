"use client";

import { useEffect, useRef, useState } from "react";
import { Award, HeartPulse, Users, Sparkles } from "lucide-react";
import { toFa } from "@/lib/utils";

const STATS = [
  { icon: Users, value: 12000, suffix: "+", label: "مراجعه‌ی موفق" },
  { icon: Award, value: 15, suffix: " سال", label: "سابقه‌ی تخصصی" },
  { icon: HeartPulse, value: 20, suffix: "+", label: "خدمت تخصصی" },
  { icon: Sparkles, value: 98, suffix: "٪", label: "رضایت مراجعین" },
];

export function Stats() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
      {STATS.map((stat, i) => (
        <div
          key={stat.label}
          className="rounded-4xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-6 text-center shadow-soft transition-transform duration-500 hover:-translate-y-1"
          style={{ transitionDelay: `${i * 90}ms` }}
        >
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-rose-100 to-cream-200 text-rose-500 dark:from-rose-500/15 dark:to-plum-800 dark:text-rose-300">
            <stat.icon className="size-6" />
          </div>
          <p className="text-2xl font-extrabold sm:text-3xl">
            <Counter to={stat.value} run={visible} />
            <span className="text-lg">{stat.suffix}</span>
          </p>
          <p className="mt-1.5 text-xs text-[color:var(--fg-muted)] sm:text-sm">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}

function Counter({ to, run }: { to: number; run: boolean }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!run) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(to);
      return;
    }
    const duration = 1400;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setValue(Math.round(to * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [run, to]);

  return <>{toFa(value.toLocaleString("en-US"))}</>;
}
