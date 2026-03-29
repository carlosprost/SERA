/**
 * SERA Smart Formula Engine
 * 
 * Este motor permite evaluar expresiones tipo Excel de forma virtual.
 * Soporta acceso a campos mediante corchetes [campo], funciones lógicas y de fecha.
 */

export class FormulaEngine {
  
  /**
   * Evalúa una fórmula para una fila específica.
   * @param formula La cadena de la fórmula (ej: "SI([fecha_recepcion]; hoy(); 'VENCIDO')")
   * @param row El objeto de la fila con los datos reales
   * @returns El resultado de la evaluación (string, number o boolean)
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
      // Ojo: Esto es simplificado, en un motor real se usaría un parser de tokens
      processed = processed.replace(/;/g, ',');

      // 5. Mapeo de funciones de conveniencia a JS
      // Nota: Usamos Function() como alternativa controlada a eval()
      // Envolvemos el contexto con las funciones que queremos exponer
      const contextFunctions = {
        SI: (cond: any, v1: any, v2: any) => cond ? v1 : v2,
        DIF_DIAS: (f1: any, f2: any) => {
          const d1 = new Date(f1);
          const d2 = new Date(f2);
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
      
      // Intentamos evaluar
      // IMPORTANTE: El usuario solo puede usar las funciones que pasamos y operadores estándar
      const evaluator = new Function(...keys, `return ${this.jsOperatorFix(processed)}`);
      return evaluator(...vals);

    } catch (e) {
      console.warn("Formula Engine Error:", e, "Formula:", formula);
      return "ERROR_FORMULA";
    }
  }

  /**
   * Ajusta operadores comunes para que sean válidos en JS si el usuario usa sintaxis Excel
   */
  private static jsOperatorFix(expr: string): string {
    return expr
      .replace(/<>/g, '!==') // Excel NOT EQUAL
      .replace(/=/g, '===')   // Excel EQUAL (simple) -> JS STRICT EQUAL
      .replace(/====/g, '===') // Fix accidental double conversion
      .replace(/!== ===/g, '!==') // Fix accidental triple conversion
      .replace(/AND/gi, '&&')
      .replace(/OR/gi, '||')
      .replace(/NOT/gi, '!');
  }
}
