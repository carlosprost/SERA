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

