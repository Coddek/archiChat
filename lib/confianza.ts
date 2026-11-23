// Qué tan respaldada está una respuesta por el documento.
// El número es la similitud coseno entre la pregunta y el fragmento más parecido
// (x100). No mide si la respuesta es correcta: mide si el documento habla de lo
// que se preguntó. Una pregunta nunca es casi idéntica a un párrafo, así que
// los valores buenos rondan 70-85, no 99.
//
// Cortes medidos con documentos reales (23/11/2026, gemini-embedding-001):
// preguntas que el documento responde: 0,67–0,85 (mediana ~0,75);
// preguntas de otro documento: 0,52–0,62. Si cambia el modelo de embeddings,
// hay que volver a medir.

export type Nivel = 'fuerte' | 'parcial' | 'debil'

export const CORTE_FUERTE = 72
export const CORTE_PARCIAL = 65

export function nivelRespaldo(confianza: number): { nivel: Nivel; titulo: string; explicacion: string } {
  if (confianza >= CORTE_FUERTE) {
    return {
      nivel: 'fuerte',
      titulo: 'Respaldo fuerte',
      explicacion: 'Los fragmentos encontrados tratan directamente sobre tu pregunta.',
    }
  }
  if (confianza >= CORTE_PARCIAL) {
    return {
      nivel: 'parcial',
      titulo: 'Respaldo parcial',
      explicacion: 'Los fragmentos se relacionan con tu pregunta, pero conviene revisarlos.',
    }
  }
  return {
    nivel: 'debil',
    titulo: 'Respaldo débil',
    explicacion: 'Los fragmentos encontrados no coinciden mucho con tu pregunta: revisá si la respuesta sale del documento.',
  }
}
