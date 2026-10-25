import Link from "next/link";
import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";

export interface FilterOption {
  label: string;
  value: string;
  href: string;
}

export function FilterMenu({
  label,
  value,
  options,
  icon,
}: {
  label: string;
  value: string;
  options: FilterOption[];
  icon?: React.ReactNode;
}) {
  return (
    <details className="group relative">
      <summary className="pill !h-10 cursor-pointer !text-[12px]">
        {icon}
        <span className="text-[var(--muted)]">{label}:</span>
        <span className="font-semibold text-[var(--text)]">{value}</span>
        <ChevronDown size={13} aria-hidden className="opacity-60 transition-transform group-open:rotate-180" />
      </summary>
      <div className="panel absolute right-0 z-30 mt-2 w-52 p-1.5">
        {options.map((option) => (
          <Link
            key={option.value}
            href={option.href}
            className="flex items-center justify-between rounded-lg px-3 py-2 text-[12px] text-[var(--text-soft)] hover:bg-[var(--panel-hi)] hover:text-[var(--text)]"
          >
            {option.label}
            {option.value === value ? <Check size={13} className="text-[var(--lime)]" aria-hidden /> : null}
          </Link>
        ))}
      </div>
    </details>
  );
}

export function FilterGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2">{children}</div>;
}

export function SettingsFilter({ href }: { href?: string }) {
  return (
    <Link
      href={href ?? "#"}
      className="icon-btn !h-10 !w-10"
      aria-label="Layout settings"
      title="Layout settings"
    >
      <SlidersHorizontal size={15} aria-hidden />
    </Link>
  );
}
