import { createClient } from '@supabase/supabase-js'

const env = (import.meta.env.VITE_APP_ENV || 'development').toLowerCase();
if (env === 'production' && import.meta.env.DEV) {
  throw new Error('ALERTA DE SEGURIDAD: Intentando conectar a PRODUCCIÓN desde un entorno local de desarrollo (localhost). Por favor, verifica tu archivo .env');
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ ERROR: Faltan las variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY.');
    console.error('Por favor, asegúrate de haberlas configurado en el panel de Vercel y haber hecho un "Redeploy".');
}

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder'
);
