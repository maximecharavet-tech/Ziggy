/** Stable layout rules shared by the canvas renderer and tests. */
export function certificateNameFontSize(length: number): number {
  const chars = Math.max(1, Math.min(24, Math.floor(length)));
  return Math.max(38, Math.min(74, 74 - Math.max(0, chars - 10) * 2));
}

export function certificateLayout(name: string) {
  const safeName = [...name].slice(0, 24).join('');
  return { name: safeName, nameFontSize: certificateNameFontSize(safeName.length), maxNameWidth: 1080, titleFontSize: 48, proudFontSize: 34 };
}
