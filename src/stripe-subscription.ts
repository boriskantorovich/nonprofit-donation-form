import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.VITE_STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

const USAGE_PRICE_ID = 'price_1Q2IES01AoyUoeVteiCDTprg'; 


export async function createSubscription(paymentMethodId: string, amount: number) {
  try {
    const customer = await stripe.customers.create({
      payment_method: paymentMethodId,
    });

    // Attach the payment method to the customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customer.id,
    });

    // Set the default payment method on the customer
    await stripe.customers.update(customer.id, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Create a subscription with an initial payment, but set it to incomplete
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [
        {
          price: USAGE_PRICE_ID,
        },
      ],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      add_invoice_items: [
        {
          price_data: {
            currency: 'usd',
            product: 'prod_Qu46ZVkA9DbcrM', // Replace with your actual product ID
            unit_amount: amount,
          },
        },
      ],
    });

    if (!subscription.latest_invoice || typeof subscription.latest_invoice === 'string') {
      console.error('Latest invoice data:', subscription.latest_invoice);
      throw new Error(`Invalid latest invoice data: ${JSON.stringify(subscription.latest_invoice)}`);
    }

    const invoice = subscription.latest_invoice as Stripe.Invoice;
    
    if (!invoice.payment_intent) {
      console.error('No payment intent found for the invoice.');
      throw new Error('No payment intent found for the invoice.');
    }

    let clientSecret: string | null = null;

    if (typeof invoice.payment_intent === 'string') {
      const paymentIntent = await stripe.paymentIntents.retrieve(invoice.payment_intent);
      clientSecret = paymentIntent.client_secret;
    } else {
      clientSecret = invoice.payment_intent.client_secret;
    }

    // Report usage using the meter events API
    const units = Math.round(amount / 100); // Convert cents to dollars

    await stripe.billing.meterEvents.create({
      event_name: 'donation_amont', // Replace with your actual meter event name
      identifier: subscription.id, // Using subscription ID as a unique identifier
      payload: {
        value: units.toString(),
        stripe_customer_id: customer.id
      },
      timestamp: Math.floor(Date.now() / 1000), // Current timestamp in seconds
    });

    return {
      subscriptionId: subscription.id,
      clientSecret,
      status: subscription.status,
      invoiceStatus: invoice.status,
    };

  } catch (error) {
    console.error("Error creating subscription:", error);
    throw error;
  }
}
