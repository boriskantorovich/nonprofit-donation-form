// vite.server.ts

import { ViteDevServer } from 'vite';
import cors from 'cors';
import { NextHandleFunction } from 'connect';
import { createSubscription } from './src/stripe-subscription';
import { handleWebhook } from './src/handlers/stripe-webhooks';
import { IncomingMessage, ServerResponse } from 'http';

interface SubscriptionRequest extends IncomingMessage {
  body?: {
    paymentMethodId?: string;
    priceId?: string;
    amount?: number;
    [key: string]: unknown;
  };
}

export function configureServer(server: ViteDevServer): void {
  const corsMiddleware: NextHandleFunction = cors();
  server.middlewares.use(corsMiddleware);

  server.middlewares.use((req: SubscriptionRequest, _res: ServerResponse, next) => {
    let body = '';

    req.on('data', (chunk: Buffer) => {
      body += chunk.toString('utf8');
    });

    req.on('end', () => {
      if (body) {
        try {
          req.body = JSON.parse(body);
        } catch (error) {
          console.error('Failed to parse JSON body:', error);
          req.body = {};
        }
      } else {
        req.body = {};
      }
      next();
    });
  });

  server.middlewares.use(async (req: SubscriptionRequest, res: ServerResponse, next) => {
    if (req.method === 'POST' && req.url === '/create-subscription') {
      try {
        const { paymentMethodId, amount } = req.body ?? {};

        if (!paymentMethodId || amount === undefined) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "PaymentMethodId and amount are required." }));
          return;
        }

        const validPaymentMethodId = String(paymentMethodId);
        const validAmount = Number(amount);

        if (isNaN(validAmount) || validAmount < 300 || validAmount > 10000000) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid amount. Must be between $3 and $100,000." }));
          return;
        }

        const result = await createSubscription(validPaymentMethodId, validAmount);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (error) {
        console.error('Error creating subscription:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
      }
    } else if (req.method === 'POST' && req.url === '/webhook') {
      // Handle Stripe webhook
      await handleWebhook(req, res);
    } else {
      next();
    }
  });
}
