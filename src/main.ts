import { bootstrapApplication } from "@angular/platform-browser";
import { appConfig } from "./app/app.config";
import { AppComponent } from "./app/app.component";

// Deshabilitar el menú contextual por defecto del navegador (para dar sensación de app nativa Desktop)
// Excepto en campos de texto donde el usuario podría querer hacer click derecho -> Pegar
document.addEventListener('contextmenu', event => {
  const target = event.target as HTMLElement;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
    return; // Permitir menú nativo en inputs
  }
  event.preventDefault(); // Bloquear menú nativo en el resto de la app
});

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err),
);
