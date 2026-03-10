export const CLASS_COLORS = [
  '#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#c62828',
  '#00838f', '#4e342e', '#283593', '#558b2f', '#ad1457',
];

export function getClassColor(className: string, projectClasses: string[]): string {
  const index = projectClasses.indexOf(className);
  if (index >= 0) return CLASS_COLORS[index % CLASS_COLORS.length];
  // Fallback: hash-based color
  let hash = 0;
  for (let i = 0; i < className.length; i++) {
    hash = className.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CLASS_COLORS[Math.abs(hash) % CLASS_COLORS.length];
}
