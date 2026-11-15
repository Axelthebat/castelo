import type { FastifyError, FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Erro de API com corpo canónico `{ error: { code, message, fields? } }`.
 * Nunca expor stack traces ao cliente (CONTRATO §4/§7).
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function apiError(status: number, code: string, message: string, fields?: Record<string, string>) {
  return { error: fields ? { code, message, fields } : { code, message } };
}

interface HasStatus {
  statusCode?: number;
  code?: string;
  validation?: unknown;
}

/** Registra o handler global de erros e o 404 canónico. */
export function registerErrorHandlers(app: FastifyInstance): void {
  app.setNotFoundHandler((req: FastifyRequest, reply: FastifyReply) => {
    reply.code(404).send(apiError(404, 'not_found', 'Rota não encontrada'));
  });

  app.setErrorHandler((err: FastifyError | HasStatus, req: FastifyRequest, reply: FastifyReply) => {
    if (err instanceof HttpError) {
      reply.code(err.status).send(apiError(err.status, err.code, err.message, err.fields));
      return;
    }

    const status = typeof err.statusCode === 'number' ? err.statusCode : 500;

    // Corpo JSON malformado / payload grande / validação do parser do Fastify.
    if (status === 400) {
      reply.code(400).send(apiError(400, 'validation', 'Corpo da requisição inválido'));
      return;
    }

    // Rate limit (plugin registra statusCode 429 e code FST_...).
    if (status === 429) {
      reply.code(429).send(apiError(429, 'rate_limit', 'Muitas requisições. Tente novamente em instantes.'));
      return;
    }

    // Outros 4xx do Fastify (roteamento, método, etc.).
    if (status >= 400 && status < 500) {
      const code = typeof err.code === 'string' ? err.code : 'bad_request';
      reply.code(status).send(apiError(status, code, err.message || 'Requisição inválida'));
      return;
    }

    // 5xx: loga o stack apenas no servidor e devolve resposta genérica.
    req.log.error({ err }, 'Erro interno');
    reply.code(500).send(apiError(500, 'internal', 'Erro interno'));
  });
}
