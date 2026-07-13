import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dmrevpsqqavzxcavsjvd.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtcmV2cHNxcWF2enhjYXZzanZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0Njg0NjcsImV4cCI6MjA5OTA0NDQ2N30.umbOAnZBNEaHeQpMIQZxq3c1g-p_r634f_Nr1E1mW24';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Por padrão o supabase-js usa navigator.locks pra sincronizar a sessão
    // entre abas — uma API que o zone.js (Angular) NÃO rastreia. Resultado:
    // qualquer fluxo que passe por getSession() termina "fora da zona" e a
    // tela não re-renderiza quando os dados chegam (só após um clique ou F5).
    // Este lock no-op mantém tudo em Promises normais, que o Angular rastreia.
    lock: async (_name, _acquireTimeout, fn) => await fn(),
  },
});
