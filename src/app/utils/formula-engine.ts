/**
 * SERA Smart Formula Engine
 * 
 * Este motor permite evaluar expresiones tipo Excel de forma virtual.
 * Soporta acceso a campos mediante corchetes [campo], funciones lógicas y de fecha.
 */

export class FormulaEngine {
  
  /**
   * Evalúa una fórmula para una fila específica.
   * @param formula La cadena de la fórmula (ej: "DIF_DIAS([fecha_de_recepcion]; HOY()) > [termino]")
   * @param row El objeto de la fila con los datos reales
   * @returns El resultado de la evaluación (string, number o boolean), o undefined si hay error
   */
  static evaluate(formula: string, row: any): any {
    if (!formula || typeof formula !== 'string') return '';

    try {
      // 1. Limpieza inicial y normalización
      let processed = formula.trim();
      if (processed.startsWith('=')) processed = processed.substring(1);

      // 2. Reemplazo de campos [campo] por sus valores reales
      // Protegemos los valores para que no rompan la evaluación
      processed = processed.replace(/\[(.*?)\]/g, (match, fieldName) => {
        const val = row[fieldName];
        if (val === undefined || val === null) return "''";
        if (typeof val === 'number') return val.toString();
        // Si es string, escapamos comillas simples
        return `'${String(val).replace(/'/g, "\\'")}'`;
      });

      // 3. Implementación de funciones core
      // HOY() -> Retorna timestamp actual (sin hora)
      processed = processed.replace(/HOY\(\)/gi, () => {
        const d = new Date();
        d.setHours(0,0,0,0);
        return d.getTime().toString();
      });

      // AHORA() -> Retorna timestamp completo
      processed = processed.replace(/AHORA\(\)/gi, () => Date.now().toString());

      // 4. Transformación de sintaxis regional (punto y coma por coma)
      processed = processed.replace(/;/g, ',');

      // 5. Mapeo de funciones de conveniencia a JS
      const contextFunctions = {
        SI: (cond: any, v1: any, v2: any) => cond ? v1 : v2,
        
        // Función IGUAL: compara dos valores ignorando mayúsculas/minúsculas
        IGUAL: (v1: any, v2: any) => String(v1).toLowerCase() === String(v2).toLowerCase(),

        DIF_DIAS: (f1: any, f2: any) => {
          // HOY() ya es un timestamp numérico (number).
          // Si f1 es un string con fecha (DD/MM/YYYY o YYYY-MM-DD), lo parseamos.
          const parseDate = (v: any): Date => {
            if (typeof v === 'number') return new Date(v);
            const s = String(v).trim();
            
            // Formato DD/MM/YYYY
            const ddmmyyyy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (ddmmyyyy) {
              return new Date(
                parseInt(ddmmyyyy[3]),  // año
                parseInt(ddmmyyyy[2]) - 1, // mes (0-indexed)
                parseInt(ddmmyyyy[1])   // día
              );
            }
            
            // Formato YYYY-MM-DD (ISO)
            const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (iso) {
              return new Date(
                parseInt(iso[1]),
                parseInt(iso[2]) - 1,
                parseInt(iso[3])
              );
            }
            
            // Último recurso: dejar que JS lo intente
            return new Date(s);
          };
          
          const d1 = parseDate(f1);
          const d2 = parseDate(f2);
          if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
          const diffRaw = d2.getTime() - d1.getTime();
          return Math.floor(diffRaw / (1000 * 60 * 60 * 24));
        },

        CONCAT: (...args: any[]) => args.join(''),
        ESTA_VACIO: (v: any) => v === null || v === undefined || v === '' || v === "''",
        MAYUS: (t: any) => String(t).toUpperCase(),
        MINUS: (t: any) => String(t).toLowerCase()
      };

      // Creamos una función que tenga acceso a estas utilidades
      const keys = Object.keys(contextFunctions);
      const vals = Object.values(contextFunctions);
      
      // Evaluar la expresión con las funciones de contexto disponibles
      const evaluator = new Function(...keys, `return ${this.jsOperatorFix(processed)}`);
      return evaluator(...vals);

    } catch (e) {
      console.warn("Formula Engine Error:", e, "Formula:", formula);
      // Retornamos undefined (falsy) en lugar de "ERROR_FORMULA" (string truthy).
      // Esto evita que una fórmula con error se evalúe como "condición cumplida"
      // en checkRuleMatch(), lo que causaba que todas las reglas se aplicaran
      // incorrectamente a filas donde la fórmula fallaba.
      return undefined;
    }
  }

  /**
   * Evalúa una fórmula y devuelve el string de error visible para campos calculados.
   * Usar SOLO cuando se necesita mostrar el resultado al usuario (Campos Inteligentes).
   * NO usar para evaluación de reglas de color.
   */
  static evaluateForDisplay(formula: string, row: any): any {
    const result = this.evaluate(formula, row);
    if (result === undefined) return 'ERROR_FORMULA';
    return result;
  }

  /**
   * Ajusta operadores comunes para que sean válidos en JS si el usuario usa sintaxis Excel
   */
  private static jsOperatorFix(expr: string): string {
    return expr
      .replace(/<>/g, '!==') // Excel NOT EQUAL
      .replace(/(?<![=!<>])=(?!=)/g, '===')  // = simple -> === (evita reemplazar == o >=)
      .replace(/====/g, '===') // Fix accidental conversión doble
      .replace(/!== ===/g, '!==') // Fix accidental conversión triple
      .replace(/AND/gi, '&&')
      .replace(/OR/gi, '||')
      .replace(/NOT/gi, '!');
  }
}
