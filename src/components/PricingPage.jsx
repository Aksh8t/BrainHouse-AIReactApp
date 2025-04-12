import { useState } from "react";
import { check } from "../assets";
import { pricing } from "../constants";
import Button from "./Button";
import { LeftLine, RightLine } from "./design/Pricing";
import Section from "./Section";
import Heading from "./Heading";
import { useUser } from "@clerk/clerk-react";

const PricingPage = () => {
  const { user, isLoaded } = useUser();

  const handlePayment = async (item) => {
    if (!isLoaded || !user) {
      alert("Please log in to make a payment.");
      return;
    }

    try {
      const paymentUrl = `https://razorpay.me/@brainhouse`;
      window.location.href = paymentUrl;
    } catch (error) {
      console.error("Payment redirection error:", error.message);
      alert(
        `Failed to redirect to payment page: ${error.message}. Please try again or contact support.`
      );
    }
  };

  return (
    <Section className="overflow-hidden" id="pricing">
      <div className="container relative z-2">
        <Heading
          tag="Choose your plan"
          title="Flexible pricing for all needs"
        />

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
                      <div className="h3">₹</div>
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
                  disabled={!item.price || !isLoaded || !user}
                >
                  {item.price ? "Pay Now" : "Contact us"}
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
