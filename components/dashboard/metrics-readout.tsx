export function MetricsReadout({ messages }: { messages: number }) {
  return (
    <div className="flex items-center gap-4 text-[10px] tracking-[0.1em] text-terminal-fg-dim">
      <span>
        MSGS <span className="tabular-nums text-terminal-fg">{messages}</span>
      </span>
    </div>
  );
}
