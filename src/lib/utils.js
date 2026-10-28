export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

export function formatNumber(value) {
  return new Intl.NumberFormat('ar-MA').format(value);
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
