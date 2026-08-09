import { createConnection } from 'mysql2/promise';

interface HyperdriveBinding {
  host: string;
  user: string;
  password: string;
  database: string;
  port: number;
}

interface Env {
  HYPERDRIVE: HyperdriveBinding;
}

export const probeQuery = 'SELECT 1 AS ok';

type Connector = typeof createConnection;

export async function runProbe(
  env: Env,
  now = Date.now,
  connect: Connector = createConnection,
): Promise<Response> {
  const startedAt = now();
  let connection: Awaited<ReturnType<typeof createConnection>> | undefined;

  try {
    connection = await connect({
      host: env.HYPERDRIVE.host,
      user: env.HYPERDRIVE.user,
      password: env.HYPERDRIVE.password,
      database: env.HYPERDRIVE.database,
      port: env.HYPERDRIVE.port,
      connectTimeout: 5_000,
      disableEval: true,
    });
    const [rows] = await connection.query(probeQuery);
    const firstRow = Array.isArray(rows) ? rows[0] : undefined;
    const ok = typeof firstRow === 'object' && firstRow !== null &&
      'ok' in firstRow && firstRow.ok === 1;

    if (!ok) throw new Error('Unexpected probe result');

    return Response.json({ status: 'ok', latencyMs: now() - startedAt });
  } catch {
    return Response.json({
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database probe failed.',
      },
      latencyMs: now() - startedAt,
    }, { status: 503 });
  } finally {
    await connection?.end().catch(() => undefined);
  }
}

export default {
  fetch(_request: Request, env: Env): Promise<Response> {
    return runProbe(env);
  },
};
