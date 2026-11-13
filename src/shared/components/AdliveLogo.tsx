import type { HTMLAttributes } from "react";

export interface AdliveLogoProps extends HTMLAttributes<HTMLDivElement> {
  /** `dark` para fondos claros, `light` para el sidebar oscuro. */
  tone?: "dark" | "light";
  size?: "sm" | "md";
}

/** Logo ADlive CRM: ícono en degradado #5B00FF → #29C5F6 + wordmark. */
export function AdliveLogo({ tone = "dark", size = "md", className = "", ...rest }: AdliveLogoProps) {
  const textClass = tone === "light" ? "text-white" : "text-adlive-text-main";
  const boxClass = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const textSize = size === "sm" ? "text-lg" : "text-xl";
  return (
    <div className={`flex items-center gap-2.5 ${className}`} {...rest}>
      <span
        aria-hidden
        className={`flex ${boxClass} items-center justify-center rounded-xl bg-gradient-to-br from-adlive-primary to-adlive-cyan shadow-card`}
      >
        <svg viewBox="0 0 24 24" fill="none" className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} aria-hidden>
          <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z" fill="#E6FF00" stroke="#FFFFFF" strokeWidth="1" strokeLinejoin="round" />
        </svg>
      </span>
      <span className={`${textSize} font-bold tracking-tight ${textClass}`}>
        ADlive <span className={tone === "light" ? "text-adlive-cyan" : "text-adlive-primary"}>CRM</span>
      </span>
    </div>
  );
}
