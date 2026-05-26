export interface PluginInfo {
  id: string;
  nombre: string;
  version: string;
  descripcion?: string;
  autor?: string;
  entrypoint: string;
  stylesheet?: string;
  activo: boolean;
  config?: string; // JSON String
  /** Si está en true, SERA verifica y actualiza el plugin automáticamente al abrir la sección */
  auto_update?: boolean;
}

export interface RibbonButtonConfig {
  id: string;
  label: string;
  icon: string;
  tooltip?: string;
  action: () => void;
}

export interface SidebarTabConfig {
  id: string;
  title: string;
  icon: string;
  action: () => void;
}

