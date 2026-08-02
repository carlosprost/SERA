/**
 * Interfaces y colecciones de presets para el diseño de tablas en reportes PDF.
 * Provee estilos inspirados en galerías de hojas de cálculo (Excel/Sheets)
 * con categorías Claro, Medio, Oscuro y Minimalista.
 */

export type PdfTableBorder = 'full' | 'horizontal' | 'minimal' | 'none';
export type PdfTableFontSize = 'compact' | 'normal' | 'large';

export interface PdfTableStyle {
  presetId: string;
  headerBg: string;
  headerTextColor: string;
  alternateRows: boolean;
  alternateRowBg: string;
  borderColor: string;
  borderStyle: PdfTableBorder;
  fontFamily: string;
  fontSize: PdfTableFontSize;
  headerAlign: 'left' | 'center';
  highlightFirstColumn: boolean;
}

export interface PdfTablePreset {
  id: string;
  nombre: string;
  categoria: 'claro' | 'medio' | 'oscuro' | 'minimal';
  style: PdfTableStyle;
  badgeColor: string;
  previewBg: string;
}

export const AVAILABLE_PDF_FONTS = [
  { label: 'Arial (Estándar)', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Roboto (Moderno)', value: "'Roboto', sans-serif" },
  { label: 'Inter (Limpio UI)', value: "'Inter', sans-serif" },
  { label: 'Segoe UI (Sistema)', value: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" },
  { label: 'Georgia (Serif Legal)', value: "Georgia, 'Times New Roman', Times, serif" },
  { label: 'Consolas (Monoespaciado)', value: "'Consolas', 'Courier New', monospace" }
];

export const DEFAULT_PDF_TABLE_STYLE: PdfTableStyle = {
  presetId: 'medio-azul',
  headerBg: '#1e3a8a',
  headerTextColor: '#ffffff',
  alternateRows: true,
  alternateRowBg: '#f1f5f9',
  borderColor: '#cbd5e1',
  borderStyle: 'full',
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: 'normal',
  headerAlign: 'left',
  highlightFirstColumn: false
};

export const PDF_TABLE_PRESETS: PdfTablePreset[] = [
  // ─── CATEGORÍA MEDIO (CORPORATIVO / ESTÁNDAR) ───
  {
    id: 'medio-azul',
    nombre: 'Azul SERA',
    categoria: 'medio',
    badgeColor: '#1e3a8a',
    previewBg: '#1e3a8a',
    style: {
      presetId: 'medio-azul',
      headerBg: '#1e3a8a',
      headerTextColor: '#ffffff',
      alternateRows: true,
      alternateRowBg: '#f1f5f9',
      borderColor: '#cbd5e1',
      borderStyle: 'full',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 'normal',
      headerAlign: 'left',
      highlightFirstColumn: false
    }
  },
  {
    id: 'medio-esmeralda',
    nombre: 'Verde Bosque',
    categoria: 'medio',
    badgeColor: '#065f46',
    previewBg: '#065f46',
    style: {
      presetId: 'medio-esmeralda',
      headerBg: '#065f46',
      headerTextColor: '#ffffff',
      alternateRows: true,
      alternateRowBg: '#f0fdf4',
      borderColor: '#a7f3d0',
      borderStyle: 'full',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 'normal',
      headerAlign: 'left',
      highlightFirstColumn: false
    }
  },
  {
    id: 'medio-grafito',
    nombre: 'Carbón Slate',
    categoria: 'medio',
    badgeColor: '#334155',
    previewBg: '#334155',
    style: {
      presetId: 'medio-grafito',
      headerBg: '#334155',
      headerTextColor: '#ffffff',
      alternateRows: true,
      alternateRowBg: '#f8fafc',
      borderColor: '#cbd5e1',
      borderStyle: 'full',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 'normal',
      headerAlign: 'left',
      highlightFirstColumn: false
    }
  },
  {
    id: 'medio-rubi',
    nombre: 'Borgoña Real',
    categoria: 'medio',
    badgeColor: '#881337',
    previewBg: '#881337',
    style: {
      presetId: 'medio-rubi',
      headerBg: '#881337',
      headerTextColor: '#ffffff',
      alternateRows: true,
      alternateRowBg: '#fff1f2',
      borderColor: '#fecdd3',
      borderStyle: 'full',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 'normal',
      headerAlign: 'left',
      highlightFirstColumn: false
    }
  },
  {
    id: 'medio-indigo',
    nombre: 'Índigo Ejecutivo',
    categoria: 'medio',
    badgeColor: '#4338ca',
    previewBg: '#4338ca',
    style: {
      presetId: 'medio-indigo',
      headerBg: '#4338ca',
      headerTextColor: '#ffffff',
      alternateRows: true,
      alternateRowBg: '#eef2ff',
      borderColor: '#c7d2fe',
      borderStyle: 'full',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 'normal',
      headerAlign: 'left',
      highlightFirstColumn: false
    }
  },
  {
    id: 'medio-naranja',
    nombre: 'Ámbar Cálido',
    categoria: 'medio',
    badgeColor: '#c2410c',
    previewBg: '#c2410c',
    style: {
      presetId: 'medio-naranja',
      headerBg: '#c2410c',
      headerTextColor: '#ffffff',
      alternateRows: true,
      alternateRowBg: '#fff7ed',
      borderColor: '#fed7aa',
      borderStyle: 'full',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 'normal',
      headerAlign: 'left',
      highlightFirstColumn: false
    }
  },
  {
    id: 'medio-cian',
    nombre: 'Cian Moderno',
    categoria: 'medio',
    badgeColor: '#0e7490',
    previewBg: '#0e7490',
    style: {
      presetId: 'medio-cian',
      headerBg: '#0e7490',
      headerTextColor: '#ffffff',
      alternateRows: true,
      alternateRowBg: '#ecfeff',
      borderColor: '#a5f3fc',
      borderStyle: 'full',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 'normal',
      headerAlign: 'left',
      highlightFirstColumn: false
    }
  },

  // ─── CATEGORÍA CLARO (SUAVE / PASTEL) ───
  {
    id: 'claro-azul',
    nombre: 'Claro Azul',
    categoria: 'claro',
    badgeColor: '#1a73e8',
    previewBg: '#e8f0fe',
    style: {
      presetId: 'claro-azul',
      headerBg: '#e8f0fe',
      headerTextColor: '#1a73e8',
      alternateRows: true,
      alternateRowBg: '#f8fafd',
      borderColor: '#d2e3fc',
      borderStyle: 'full',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 'normal',
      headerAlign: 'left',
      highlightFirstColumn: false
    }
  },
  {
    id: 'claro-esmeralda',
    nombre: 'Claro Esmeralda',
    categoria: 'claro',
    badgeColor: '#137333',
    previewBg: '#e6f4ea',
    style: {
      presetId: 'claro-esmeralda',
      headerBg: '#e6f4ea',
      headerTextColor: '#137333',
      alternateRows: true,
      alternateRowBg: '#f6fbf7',
      borderColor: '#ceead6',
      borderStyle: 'full',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 'normal',
      headerAlign: 'left',
      highlightFirstColumn: false
    }
  },
  {
    id: 'claro-ambar',
    nombre: 'Claro Dorado',
    categoria: 'claro',
    badgeColor: '#b06000',
    previewBg: '#fef7e0',
    style: {
      presetId: 'claro-ambar',
      headerBg: '#fef7e0',
      headerTextColor: '#b06000',
      alternateRows: true,
      alternateRowBg: '#fffdf7',
      borderColor: '#feefc3',
      borderStyle: 'full',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 'normal',
      headerAlign: 'left',
      highlightFirstColumn: false
    }
  },
  {
    id: 'claro-grafito',
    nombre: 'Claro Grafito',
    categoria: 'claro',
    badgeColor: '#3c4043',
    previewBg: '#f1f3f4',
    style: {
      presetId: 'claro-grafito',
      headerBg: '#f1f3f4',
      headerTextColor: '#3c4043',
      alternateRows: true,
      alternateRowBg: '#fafafa',
      borderColor: '#dadce0',
      borderStyle: 'full',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 'normal',
      headerAlign: 'left',
      highlightFirstColumn: false
    }
  },
  {
    id: 'claro-violeta',
    nombre: 'Claro Violeta',
    categoria: 'claro',
    badgeColor: '#7627bb',
    previewBg: '#f3e8fd',
    style: {
      presetId: 'claro-violeta',
      headerBg: '#f3e8fd',
      headerTextColor: '#7627bb',
      alternateRows: true,
      alternateRowBg: '#faf5ff',
      borderColor: '#e9d5ff',
      borderStyle: 'full',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 'normal',
      headerAlign: 'left',
      highlightFirstColumn: false
    }
  },

  // ─── CATEGORÍA OSCURO (ALTO IMPACTO) ───
  {
    id: 'oscuro-ebano',
    nombre: 'Ébano Ejecutivo',
    categoria: 'oscuro',
    badgeColor: '#111827',
    previewBg: '#111827',
    style: {
      presetId: 'oscuro-ebano',
      headerBg: '#111827',
      headerTextColor: '#ffffff',
      alternateRows: true,
      alternateRowBg: '#f3f4f6',
      borderColor: '#4b5563',
      borderStyle: 'full',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 'normal',
      headerAlign: 'left',
      highlightFirstColumn: false
    }
  },
  {
    id: 'oscuro-noche',
    nombre: 'Azul Medianoche',
    categoria: 'oscuro',
    badgeColor: '#0f172a',
    previewBg: '#0f172a',
    style: {
      presetId: 'oscuro-noche',
      headerBg: '#0f172a',
      headerTextColor: '#ffffff',
      alternateRows: true,
      alternateRowBg: '#f8fafc',
      borderColor: '#334155',
      borderStyle: 'full',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 'normal',
      headerAlign: 'left',
      highlightFirstColumn: false
    }
  },
  {
    id: 'oscuro-esmeralda',
    nombre: 'Verde Profundo',
    categoria: 'oscuro',
    badgeColor: '#022c22',
    previewBg: '#022c22',
    style: {
      presetId: 'oscuro-esmeralda',
      headerBg: '#022c22',
      headerTextColor: '#ffffff',
      alternateRows: true,
      alternateRowBg: '#f0fdf4',
      borderColor: '#064e3b',
      borderStyle: 'full',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 'normal',
      headerAlign: 'left',
      highlightFirstColumn: false
    }
  },
  {
    id: 'oscuro-mocca',
    nombre: 'Café Mocca',
    categoria: 'oscuro',
    badgeColor: '#451a03',
    previewBg: '#451a03',
    style: {
      presetId: 'oscuro-mocca',
      headerBg: '#451a03',
      headerTextColor: '#ffffff',
      alternateRows: true,
      alternateRowBg: '#fefce8',
      borderColor: '#78350f',
      borderStyle: 'full',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 'normal',
      headerAlign: 'left',
      highlightFirstColumn: false
    }
  },

  // ─── CATEGORÍA MINIMALISTA / EDITORIAL ───
  {
    id: 'minimal-lineas',
    nombre: 'Líneas Modernas',
    categoria: 'minimal',
    badgeColor: '#0f172a',
    previewBg: '#ffffff',
    style: {
      presetId: 'minimal-lineas',
      headerBg: '#ffffff',
      headerTextColor: '#0f172a',
      alternateRows: false,
      alternateRowBg: '#ffffff',
      borderColor: '#cbd5e1',
      borderStyle: 'horizontal',
      fontFamily: "'Inter', sans-serif",
      fontSize: 'normal',
      headerAlign: 'left',
      highlightFirstColumn: false
    }
  },
  {
    id: 'minimal-juridico',
    nombre: 'Jurídico Clásico',
    categoria: 'minimal',
    badgeColor: '#1e293b',
    previewBg: '#f8fafc',
    style: {
      presetId: 'minimal-juridico',
      headerBg: '#f8fafc',
      headerTextColor: '#0f172a',
      alternateRows: true,
      alternateRowBg: '#fdfdfd',
      borderColor: '#94a3b8',
      borderStyle: 'horizontal',
      fontFamily: "Georgia, 'Times New Roman', Times, serif",
      fontSize: 'normal',
      headerAlign: 'left',
      highlightFirstColumn: true
    }
  }
];
