import Stripe from 'stripe';
import dotenv from 'dotenv';
import { IncomingMessage, ServerResponse } from 'http';

dotenv.config();

const stripe = new Stripe(process.env.VITE_STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function handleWebhook(req: IncomingMessage, res: ServerResponse) {
  const sig = req.headers['stripe-signature'];

  let event: Stripe.Event;

try {
    // Accumulate the request body
    const chunks: Uint8Array[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const rawBody = Buffer.concat(chunks);

    // Verify the event by constructing it with the raw body and signature
    event = stripe.webhooks.constructEvent(rawBody, sig as string, endpointSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error type';
    console.error(`Webhook Error: ${message}`);
    res.statusCode = 400;
    res.end(`Webhook Error: ${message}`);
    return;
  }

  let invoice: Stripe.Invoice | undefined;
  let subscription: Stripe.Subscription | undefined;

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      // Handle successful payment intent
      break;
    case 'payment_intent.payment_failed':
      // Handle failed payment intent
      break;
    case 'invoice.payment_succeeded':
      invoice = event.data.object as Stripe.Invoice;
      await handleInvoicePaymentSucceeded(invoice);
      break;
    case 'invoice.payment_failed':
      invoice = event.data.object as Stripe.Invoice;
      await handleInvoicePaymentFailed(invoice);
      break;
    case 'customer.subscription.created':
      subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionCreated(subscription);
      break;
    case 'customer.subscription.updated':
      subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionUpdated(subscription);
      break;
    case 'customer.subscription.deleted':
      subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionDeleted(subscription);
      break;
    case 'charge.succeeded':
      // Handle successful charge
      break;
    case 'charge.failed':
      // Handle failed charge
      break;
    case 'charge.refunded':
      // Handle refunded charge
      break;
    case 'charge.dispute.created':
      // Handle dispute created
      break;
    case 'charge.dispute.closed':
      // Handle dispute closed
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  res.statusCode = 200;
  res.end();
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  // Implement logic for successful payment
  console.log(`Payment succeeded for invoice ${invoice.id}`);
  // You might want to update your database, send a confirmation email, etc.
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  // Implement logic for failed payment
  console.log(`Payment failed for invoice ${invoice.id}`);
  // You might want to notify the customer, update your database, etc.
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  // Implement logic for subscription creation
  console.log(`Subscription ${subscription.id} created`);
  // You might want to update your database, notify the customer, etc.
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  // Implement logic for subscription updates
  console.log(`Subscription ${subscription.id} updated to status ${subscription.status}`);
  // You might want to update your database, notify the customer, etc.
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  // Implement logic for subscription deletion
  console.log(`Subscription ${subscription.id} deleted`);
  // You might want to update your database, notify the customer, etc.
}
