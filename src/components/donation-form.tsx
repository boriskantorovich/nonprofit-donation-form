import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';

const subscriptionOptions = [
  { value: "monthly-10", label: "$10", amount: 1000 },
  { value: "monthly-20", label: "$20", amount: 2000 },
  { value: "monthly-50", label: "$50", amount: 5000 },
]

export function DonationFormComponent() {
  const [selectedOption, setSelectedOption] = useState("monthly-10")
  const [customAmount, setCustomAmount] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const stripe = useStripe()
  const elements = useElements()

  useEffect(() => {
    if (customAmount) {
      setSelectedOption("")
    }
  }, [customAmount])

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numValue = parseInt(value, 10);
    if (value === "" || (numValue >= 3 && numValue <= 100000)) {
      setCustomAmount(value);
      setSelectedOption(""); // Deselect predefined options when custom amount is entered
    }
  };

  const handleOptionChange = (value: string) => {
    setSelectedOption(value);
    const option = subscriptionOptions.find(opt => opt.value === value);
    if (option) {
      setCustomAmount((option.amount / 100).toString()); // Set custom amount to selected predefined amount
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    if (!stripe || !elements) {
      setError("Stripe has not been initialized.");
      setLoading(false);
      return;
    }

    const cardElement = elements.getElement(CardElement);

    if (!cardElement) {
      setError("Card element not found");
      setLoading(false);
      return;
    }

    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: "card",
      card: cardElement,
    });

    if (error) {
      setError(error.message || "An error occurred while processing your card.");
      setLoading(false);
      return;
    }

    let amount: number;
    if (customAmount) {
      amount = parseInt(customAmount, 10) * 100; // Convert to cents
    } else {
      const selectedSubscriptionOption = subscriptionOptions.find(option => option.value === selectedOption);
      amount = selectedSubscriptionOption ? selectedSubscriptionOption.amount : 0;
    }

    if (amount < 300 || amount > 10000000) {
      setError("Invalid amount. Must be between $3 and $100,000.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/create-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paymentMethodId: paymentMethod.id,
          amount: amount,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Unknown error');
      }

      const { clientSecret, subscriptionId } = await response.json();

      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: paymentMethod.id,
      });

      if (confirmError) {
        throw new Error(confirmError.message || "An error occurred while confirming your payment.");
      }

      if (paymentIntent.status === 'requires_action') {
        // 3D Secure authentication is required
        const { error: authError } = await stripe.confirmCardPayment(clientSecret);
        if (authError) {
          throw new Error(authError.message || "3D Secure authentication failed.");
        }
      }

      // Handle successful payment confirmation
      console.log("Payment confirmed successfully for subscription:", subscriptionId);
      // You might want to redirect the user to a success page or show a success message
    } catch (error) {
      setError(error instanceof Error ? error.message : "An unexpected error occurred");
    }

    setLoading(false);
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">Donate Now</CardTitle>
        <CardDescription className="text-center">Your support makes a difference</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <Label className="text-base font-semibold">Select a donation option:</Label>
            <RadioGroup
              value={selectedOption}
              onValueChange={handleOptionChange}
              className="grid grid-cols-1 gap-4 sm:grid-cols-3"
            >
              {subscriptionOptions.map((option) => (
                <Label
                  key={option.value}
                  className={`flex items-center justify-between rounded-lg border p-4 cursor-pointer ${
                    selectedOption === option.value ? "border-primary" : "border-gray-200"
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value={option.value} id={option.value} />
                    <span>{option.label}</span>
                  </div>
                </Label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-amount" className="text-base font-semibold">
              Or enter a custom amount (min $3):
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <Input
                type="number"
                id="custom-amount"
                placeholder="Enter amount"
                value={customAmount}
                onChange={handleCustomAmountChange}
                min={3}
                max={100000}
                step={1}
                className="pl-8"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-base font-semibold">Card Details:</Label>
            <CardElement
              className="p-2 border rounded"
              options={{
                hidePostalCode: true,
              }}
            />
          </div>

          {error && <div className="text-red-500">{error}</div>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Processing..." : "Donate Now"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
