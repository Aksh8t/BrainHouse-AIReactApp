import { useState } from "react";
import { check } from "../assets";
import { pricing } from "../constants";
import Button from "./Button";
import { LeftLine, RightLine } from "./design/Pricing";
import Section from "./Section";
import Heading from "./Heading";
import { useUser } from "@clerk/clerk-react";

// Function to load Razorpay script
function loadScript(src) {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => {
      resolve(true);
    };
    script.onerror = () => {
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

const PricingPage = () => {
  const [loading, setLoading] = useState(false);
  const { user, isLoaded } = useUser();

  const handlePayment = async (item) => {
    if (!isLoaded || !user) {
      alert("Please log in to make a payment.");
      return;
    }

    setLoading(true);

    const res = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
    if (!res) {
      alert("Razorpay SDK failed to load. Are you online?");
      setLoading(false);
      return;
    }

    try {
      const orderResponse = await fetch("/api/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: item.price * 100,
          currency: "INR",
          clerkUserId: user.id,
        }),
      });

      if (!orderResponse.ok) {
        throw new Error(`Failed to create order: ${orderResponse.statusText}`);
      }

      const order = await orderResponse.json();
      if (!order.id || !order.amount) {
        throw new Error("Invalid order response from server");
      }

      const options = {
        key: import.meta.env.VITE_RZP_KEY_ID,
        amount: order.amount,
        currency: "INR",
        name: "BrainHouse",
        description: item.title,
        order_id: order.id,
        handler: async function (response) {
          const verifyResponse = await fetch("/api/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              clerkUserId: user.id,
              amount: item.price * 100,
            }),
          });

          const verifyResult = await verifyResponse.json();
          if (verifyResult.success) {
            alert("Payment successful and subscription updated!");
          } else {
            alert("Payment verification failed. Please contact support.");
          }
        },
        prefill: {
          name: user.fullName || "Customer Name",
          email: user.emailAddresses[0]?.emailAddress || "customer@example.com",
          contact: user.phoneNumbers[0]?.phoneNumber || "9999999999",
        },
        theme: {
          color: "#3399cc",
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (error) {
      console.error("Payment error:", error.message);
      alert(`Payment failed: ${error.message}. Please try again or contact support.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Section className="overflow-hidden" id="pricing">
      <div className="container relative z-2">
        <Heading tag="Choose your plan" title="Flexible pricing for all needs" />

        <div className="relative">
          <div className="flex gap-[1rem] max-lg:flex-wrap">
            {pricing.map((item) => (
              <div
                key={item.id}
                className="w-[19rem] max-lg:w-full h-full px-6 bg-n-8 border border-n-6 rounded-[2rem] lg:w-auto even:py-14 odd:py-8 odd:my-4 [&>h4]:first:text-color-2 [&>h4]:even:text-color-1 [&>h4]:last:text-color-3"
              >
                <h4 className="h4 mb-4">{item.title}</h4>

                <p className="body-2 min-h-[4rem] mb-3 text-n-1/50">
                  {item.description}
                </p>

                <div className="flex items-center h-[5.5rem] mb-6">
                  {item.price && (
                    <>
                      <div className="h3">$</div>
                      <div className="text-[5.5rem] leading-none font-bold">
                        {item.price}
                      </div>
                    </>
                  )}
                </div>

                <Button
                  className="w-full mb-6"
                  onClick={() => item.price && handlePayment(item)}
                  white={!!item.price}
                  disabled={loading || !item.price || !isLoaded || !user}
                >
                  {loading && item.price
                    ? "Processing..."
                    : item.price
                    ? "Pay Now"
                    : "Contact us"}
                </Button>

                <ul>
                  {item.features.map((feature, index) => (
                    <li
                      key={index}
                      className="flex items-start py-5 border-t border-n-6"
                    >
                      <img src={check} width={24} height={24} alt="Check" />
                      <p className="body-2 ml-4">{feature}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <LeftLine />
          <RightLine />
        </div>

        <div className="flex justify-center mt-10">
          <a
            className="text-xs font-code font-bold tracking-wider uppercase border-b"
            href="#faq"
          >
            Have questions? Check our FAQ
          </a>
        </div>
      </div>
    </Section>
  );
};

export default PricingPage;