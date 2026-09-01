"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "sharzad-theme";

/** پیش از رندر، تم ذخیره‌شده را اعمال می‌کند تا پرش رنگ نداشته باشیم */
export function ThemeScript() {
  const code = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      /* حالت ناشناس مرورگر */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "حالت روشن" : "حالت شب"}
      title={dark ? "حالت روشن" : "حالت شب"}
      className={`grid size-10 place-items-center rounded-full border border-[color:var(--line)] transition-colors hover:bg-[color:var(--bg-sunken)] ${className}`}
    >
      {mounted && dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}
