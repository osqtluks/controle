import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export const inputCls =
  "w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent disabled:opacity-60";

export function Campo({
  rotulo,
  dica,
  children,
  className,
}: {
  rotulo: string;
  dica?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1", className)}>
      <span className="text-xs font-medium text-muted">{rotulo}</span>
      {children}
      {dica && <span className="block text-[11px] text-faint">{dica}</span>}
    </label>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={cn(inputCls, props.className)} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea rows={3} {...props} className={cn(inputCls, "resize-y", props.className)} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={cn(inputCls, "pr-8", props.className)} />;
}

export function Botao({
  variante = "primario",
  className,
  ...props
}: ComponentProps<"button"> & { variante?: "primario" | "secundario" | "perigo" }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-60",
        variante === "primario" && "bg-accent text-black hover:opacity-90",
        variante === "secundario" && "border border-line bg-card text-fg hover:bg-hover",
        variante === "perigo" && "border border-red-500/40 text-red-400 hover:bg-red-500/10",
        className,
      )}
    />
  );
}

export function Erro({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{children}</p>;
}
