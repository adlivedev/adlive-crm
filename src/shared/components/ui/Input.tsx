import { forwardRef, useId, type InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

/** Campo de texto etiquetado ADlive (labels siempre visibles — WCAG 2.2 AA). */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, className = "", id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-adlive-text-main">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        className={`h-11 w-full rounded-xl border border-adlive-border bg-white px-4 text-sm text-adlive-text-main placeholder:text-adlive-text-muted/60 transition-colors duration-150 focus:border-adlive-primary focus:outline-none focus:ring-2 focus:ring-adlive-primary/20 disabled:cursor-not-allowed disabled:bg-adlive-canvas-bg ${className}`}
        {...rest}
      />
      {hint ? <p className="text-xs text-adlive-text-muted">{hint}</p> : null}
    </div>
  );
});
