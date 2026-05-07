import { formatDual, DEFAULT_PKR_TO_USD } from "@/lib/format";

type Props = {
  pkr: number;
  rate?: number;
  className?: string;
  size?: "sm" | "md" | "lg";
};

export function DualCurrencyDisplay({
  pkr,
  rate = DEFAULT_PKR_TO_USD,
  className = "",
  size = "md",
}: Props) {
  const { pkr: pkrStr, usd: usdStr } = formatDual(pkr, rate);

  const pkrClass =
    size === "lg"
      ? "text-2xl font-bold"
      : size === "sm"
      ? "text-sm font-semibold"
      : "text-base font-semibold";
  const usdClass = size === "lg" ? "text-sm" : "text-xs";

  return (
    <span className={`flex flex-col ${className}`}>
      <span className={`${pkrClass} text-[#1e1b18] tabular-nums`}>
        {pkrStr}
      </span>
      <span className={`${usdClass} text-stone-400 tabular-nums`}>
        {usdStr}
      </span>
    </span>
  );
}
