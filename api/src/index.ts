import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './config/types';
import { auth } from './interface/routes/auth';
import { analysis } from './interface/routes/analysis';
import { credits } from './interface/routes/credits';
import { payments } from './interface/routes/payments';

const app = new Hono<{ Bindings: Env }>();

app.use(
  '/*',
  cors({
    origin: ['chrome-extension://*', 'http://localhost:*'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

app.get('/health', (c) => c.json({ status: 'ok' }));

app.route('/auth', auth);
app.route('/analysis', analysis);
app.route('/credits', credits);
app.route('/payments', payments);

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
