const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return value;
  }

  const [, year, month, day] = match;
  const monthName = MONTH_NAMES[Number(month) - 1];

  if (!monthName) {
    return value;
  }

  return `${day} ${monthName} ${year}`;
}

export function formatAmount(value: string): string {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value);

  if (!match) {
    // Unexpected precision or format should not be silently rounded.
    return value;
  }

  const [, sign, whole, fraction = ""] = match;
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${groupedWhole}.${fraction.padEnd(2, "0")}`;
}
