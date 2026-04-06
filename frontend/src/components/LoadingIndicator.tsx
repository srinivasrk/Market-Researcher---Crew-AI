import { Loader2 } from "lucide-react"

const SIZE_CLASS = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-8 w-8",
} as const

type LoadingIndicatorProps = {
  /** Shown next to (or below) the spinner; omit for icon-only. */
  message?: string
  size?: keyof typeof SIZE_CLASS
  /** `inline`: row for section placeholders; `stacked`: centered column for full-page. */
  layout?: "inline" | "stacked"
  className?: string
}

export function LoadingIndicator({
  message,
  size = "md",
  layout = "inline",
  className = "",
}: LoadingIndicatorProps) {
  const icon = SIZE_CLASS[size]
  const row =
    layout === "stacked"
      ? "flex flex-col items-center justify-center gap-3"
      : "inline-flex items-center gap-2"

  return (
    <div
      className={`${row} text-on-surface/55 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2
        className={`${icon} shrink-0 animate-spin text-primary-container`}
        strokeWidth={2}
        aria-hidden
      />
      {message ? <span className="text-sm">{message}</span> : null}
    </div>
  )
}
