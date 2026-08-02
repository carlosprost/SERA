---
name: update-sera-plugin
description: Procedimiento paso a paso para actualizar un plugin del ecosistema SERA en su propio repositorio y publicarlo en el Marketplace oficial de SERA.
---

# Actualización de Plugins en SERA Marketplace

El ecosistema de plugins de SERA ("Sistema de Expedientes de Registro Avanzado") requiere un protocolo específico de publicación de actualizaciones, ya que el Marketplace consume los archivos remotamente a través de la CDN jsDelivr y sincroniza el catálogo usando tags de GitHub.

## Procedimiento de Actualización

Cada vez que realices cambios en el código de un plugin (por ejemplo: `sera-plugin-documento`) y desees publicar la actualización, **DEBES** seguir estrictamente estos pasos:

### 1. Actualizar el Plugin (Repositorio Local del Plugin)
1. Modifica el archivo `manifest.json` en la raíz del repositorio del plugin y aumenta la versión (ej. `"version": "1.1.0"`).
2. Haz commit de tus cambios y súbelos a GitHub:
   ```bash
   git add .
   git commit -m "feat: descripción de los cambios"
   git push
   ```
3. **CRÍTICO:** Debes crear un "Git Tag" que coincida **exactamente** con la nueva versión y subirlo a GitHub. La CDN de jsDelivr usa este tag para congelar y servir los archivos.
   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```

### 2. Actualizar el Marketplace (Repositorio del Registro)
El Marketplace es un repositorio separado (`sera-plugins-marketplace`) que contiene un índice (`plugins.json`). SERA lee este archivo para saber qué plugins existen y de dónde descargarlos.

1. Ve a la carpeta del repositorio `sera-plugins-marketplace`.
2. Edita el archivo `plugins.json`.
3. Busca el objeto correspondiente al plugin que actualizaste y modifica tres campos cruciales:
   - `"version"`: Actualízala a la nueva versión (ej. `"1.1.0"`).
   - `"entry_url"`: Actualiza el tag en la URL de jsDelivr (ej. `.../sera-plugin-documento@v1.1.0/dist/index.js`).
   - `"style_url"`: Actualiza el tag en la URL de jsDelivr (ej. `.../sera-plugin-documento@v1.1.0/dist/style.css`).
4. Haz commit y push del registro:
   ```bash
   git add plugins.json
   git commit -m "feat: bump [nombre-del-plugin] a v1.1.0"
   git push
   ```

### Notas Importantes
- Si olvidas crear y subir el **Git Tag** en el repositorio del plugin, los enlaces de `entry_url` que colocaste en el marketplace fallarán con un error 404 porque jsDelivr no encontrará ese tag.
- Si omites el paso de actualizar `plugins.json` en el marketplace, la aplicación SERA no se enterará de que existe una nueva versión y no ofrecerá el botón "Actualizar" al usuario.
