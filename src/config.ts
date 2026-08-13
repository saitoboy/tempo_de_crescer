import 'dotenv/config';
import { z } from 'zod';

/**
 * Validação do ambiente na partida.
 *
 * Faltar DATABASE_URL ou escrever um cron inválido tem de derrubar o processo
 * agora, com mensagem clara, e não daqui a seis horas no meio de uma execução
 * agendada.
 */

const esquema = z.object({
  PORT: z.coerce.number().int().positive().default(3003),
  TZ: z.string().default('America/Sao_Paulo'),

  DATABASE_URL: z
    .string()
    .min(1, 'obrigatória')
    .startsWith('postgresql://', 'precisa começar com postgresql://'),

  /** Expressão cron da ingestão. "off" desliga o agendamento. */
  CRON_INGESTAO: z.string().default('0 */4 * * *'),

  /**
   * Token das rotas de escrita. Sem ele, escrever fica bloqueado.
   * Substituído por login de verdade na Fase 7.
   */
  API_TOKEN: z.string().min(16, 'use ao menos 16 caracteres').optional().or(z.literal('')),

  /** Segredo que assina os tokens de sessão. */
  JWT_SEGREDO: z.string().min(32, 'use ao menos 32 caracteres').default('trocar-este-segredo-em-producao-agora'),
  /** Quanto tempo a sessão dura. */
  JWT_HORAS: z.coerce.number().int().min(1).max(720).default(12),

  YOUTUBE_API_KEY: z.string().optional(),
  CHANNEL_HANDLE: z.string().default('@ibps.muriae'),

  /** Usuário administrador criado pelo seed. */
  ADMIN_EMAIL: z.email('e-mail inválido').optional().or(z.literal('')),
  ADMIN_SENHA: z.string().min(8, 'mínimo de 8 caracteres').optional().or(z.literal('')),
  ADMIN_NOME: z.string().default('Administrador'),

  /** Proxy corporativo, em componentes. Ver src/utils/proxy.ts. */
  PROXY_HOST: z.string().optional().or(z.literal('')),
  PROXY_PORT: z.string().default('3128'),
  PROXY_USER: z.string().optional().or(z.literal('')),
  PROXY_PASS: z.string().optional().or(z.literal('')),
});

export type Ambiente = z.infer<typeof esquema>;

function validar(): Ambiente {
  const resultado = esquema.safeParse(process.env);

  if (!resultado.success) {
    const problemas = resultado.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Ambiente inválido (.env):\n${problemas}`);
  }

  return resultado.data;
}

export const config = validar();
