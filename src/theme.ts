export const theme = {
  // ── Backgrounds ──────────────────────────────────────
  bg: '#F8F6FF',
  surface: '#FFFFFF',
  surfaceMid: 'rgba(109,40,217,0.07)',
  surfaceHigh: 'rgba(109,40,217,0.14)',

  // ── Borders ──────────────────────────────────────────
  border: 'rgba(109,40,217,0.16)',
  borderBright: 'rgba(109,40,217,0.40)',

  // ── Purple accent (main brand) ────────────────────────
  accent: '#7C3AED',
  accentBright: '#6D28D9',
  accentDeep: '#5B21B6',

  // ── Typography ───────────────────────────────────────
  text: '#1E1033',
  textMid: '#4A3880',
  textDim: '#9082BC',

  // ── Semantic ─────────────────────────────────────────
  emphasis: '#D97706',   // amber/gold — use only for PB, #1 rank, critical highlights
  success: '#059669',

  // ── UI chrome (replaces hardcoded dark values) ────────
  modal: '#FFFFFF',
  overlay: 'rgba(20,8,40,0.50)',
  nav: 'rgba(248,246,255,0.94)',
  dropdown: '#FFFFFF',
  wheelFade: '#FFFFFF',
} as const

export const memberColorPalette = [
  { accent: '#7C3AED', bg: 'rgba(124,58,237,0.07)', border: 'rgba(124,58,237,0.22)' },
  { accent: '#059669', bg: 'rgba(5,150,105,0.07)', border: 'rgba(5,150,105,0.22)' },
  { accent: '#DC2626', bg: 'rgba(220,38,38,0.07)', border: 'rgba(220,38,38,0.22)' },
  { accent: '#2563EB', bg: 'rgba(37,99,235,0.07)', border: 'rgba(37,99,235,0.22)' },
  { accent: '#DB2777', bg: 'rgba(219,39,119,0.07)', border: 'rgba(219,39,119,0.22)' },
] as const
