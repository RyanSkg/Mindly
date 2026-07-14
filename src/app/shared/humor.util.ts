export interface HumorInfo {
  id: string;
  label: string;
  emoji: string;
  valor: number;
}

/** valor: intensidade do humor numa escala de 1 (ruim) a 9 (ótimo), usada no gráfico do Dashboard */
export const LISTA_HUMOR: HumorInfo[] = [
  { id: 'bem', label: 'Bem', emoji: '😊', valor: 9 },
  { id: 'motivado', label: 'Motivado', emoji: '🔥', valor: 9 },
  { id: 'otimista', label: 'Otimista', emoji: '🌟', valor: 8 },
  { id: 'neutro', label: 'Neutro', emoji: '😐', valor: 5 },
  { id: 'cansado', label: 'Cansado', emoji: '😴', valor: 5 },
  { id: 'confuso', label: 'Confuso', emoji: '😕', valor: 4 },
  { id: 'inseguro', label: 'Inseguro', emoji: '😣', valor: 4 },
  { id: 'receioso', label: 'Receioso', emoji: '😟', valor: 4 },
  { id: 'ansioso', label: 'Ansioso', emoji: '😰', valor: 3 },
  { id: 'envergonhado', label: 'Envergonhado', emoji: '😳', valor: 3 },
  { id: 'pessimista', label: 'Pessimista', emoji: '😞', valor: 3 },
  { id: 'irritado', label: 'Irritado', emoji: '😤', valor: 2 },
  { id: 'frustrado', label: 'Frustrado', emoji: '😫', valor: 2 },
  { id: 'triste', label: 'Triste', emoji: '😔', valor: 2 },
];

const MAPA_HUMOR = new Map(LISTA_HUMOR.map((h) => [h.id, h]));

export function emojiDoHumor(id: string): string {
  return MAPA_HUMOR.get(id)?.emoji ?? '😶';
}

export function labelDoHumor(id: string): string {
  return MAPA_HUMOR.get(id)?.label ?? id;
}

export function valorDoHumor(id: string): number {
  return MAPA_HUMOR.get(id)?.valor ?? 5;
}
