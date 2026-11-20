"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared/components/ui/Button";

import { copyText } from "./settingsUtils";

export function CaptureCopyButton({ value, label, copiedLabel = "Copiado" }: { value: string; label: string; copiedLabel?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (!value || !await copyText(value)) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button type="button" size="sm" variant="secondary" onClick={() => void copy()} aria-label={copied ? copiedLabel : label}>
      {copied ? <Check className="h-4 w-4 text-adlive-success" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      {copied ? copiedLabel : label}
    </Button>
  );
}
