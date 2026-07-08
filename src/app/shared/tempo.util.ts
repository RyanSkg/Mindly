export function tempoRelativo(data: Date): string {
  const agora = new Date();
  const diffMs = agora.getTime() - data.getTime();
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDias <= 0) return 'hoje';
  if (diffDias === 1) return 'há 1 dia';
  if (diffDias < 7) return `há ${diffDias} dias`;

  const semanas = Math.floor(diffDias / 7);
  if (semanas === 1) return 'há 1 semana';
  if (semanas < 5) return `há ${semanas} semanas`;

  const meses = Math.floor(diffDias / 30);
  if (meses <= 1) return 'há 1 mês';
  return `há ${meses} meses`;
}
