export const DEFAULT_PKR_TO_USD = 278;

const pkrFormatter = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPKR(amount: number): string {
  return pkrFormatter.format(amount);
}

export function formatUSD(amount: number): string {
  return usdFormatter.format(amount);
}

export function pkrToUsd(pkr: number, rate = DEFAULT_PKR_TO_USD): number {
  return pkr / rate;
}

export function formatDual(
  pkr: number,
  rate = DEFAULT_PKR_TO_USD
): { pkr: string; usd: string } {
  return {
    pkr: formatPKR(pkr),
    usd: formatUSD(pkrToUsd(pkr, rate)),
  };
}
