/**
 * Valida que um valor é um UUID de verdade antes de interpolá-lo em filtros
 * de string do Supabase (ex: .or("solicitante_id.eq.<id>")). Os filtros .eq()
 * normais já são parametrizados pelo PostgREST; isso protege os poucos pontos
 * onde o filtro é montado por texto.
 */
const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ehUuidValido(valor: unknown): valor is string {
  return typeof valor === 'string' && REGEX_UUID.test(valor);
}
