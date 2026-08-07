export function cn(...args: Array<string | false | null | undefined>): string {
  return args.filter(Boolean).join(" ");
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}
