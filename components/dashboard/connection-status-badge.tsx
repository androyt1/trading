export type ConnectionStatus = "live" | "reconnecting" | "offline";

const CONFIG: Record<
  ConnectionStatus,
  { label: string; dotClass: string; textClass: string }
> = {
  live: {
    label: "LIVE",
    dotClass: "bg-terminal-green animate-pulse-live",
    textClass: "text-terminal-green",
  },
  reconnecting: {
    label: "RECONNECTING",
    dotClass: "bg-terminal-amber animate-pulse-live",
    textClass: "text-terminal-amber",
  },
  offline: {
    label: "OFFLINE",
    dotClass: "bg-terminal-red",
    textClass: "text-terminal-red",
  },
};

export function ConnectionStatusBadge({ status }: { status: ConnectionStatus }) {
  const config = CONFIG[status];
  return (
    <div className="flex items-center gap-2 border border-terminal-border bg-terminal-panel px-3 py-1.5">
      <span className={`h-2 w-2 rounded-full ${config.dotClass}`} />
      <span className={`text-xs font-semibold tracking-[0.2em] ${config.textClass}`}>
        {config.label}
      </span>
    </div>
  );
}
