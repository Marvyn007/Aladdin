"use client";

import * as React from "react";
import { Diamond, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PricingCardProps {
  title: string;
  price?: string;
  priceDescription?: string;
  description: string;
  features?: string[];
  buttonText: string;
  imageSrc?: string;
  imageAlt?: string;
  isUnique?: boolean;
  className?: string;
  useSparkles?: boolean;
}

function PricingCard({
  className,
  title,
  price,
  priceDescription,
  description,
  features,
  buttonText,
  imageSrc,
  imageAlt,
  useSparkles = false,
  ...props
}: PricingCardProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "group relative flex h-full flex-col justify-between rounded-2xl border border-border/50 bg-card/50 p-8 text-card-foreground backdrop-blur-sm transition-all duration-500",
        isHovered && "scale-[1.02] -translate-y-2 border-primary/20 bg-card",
        className
      )}
      style={isHovered ? { boxShadow: "0 25px 50px -12px hsl(var(--foreground) / 0.15)" } : {}}
      {...props}
    >
      <div className="flex flex-col space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <h3 className="text-2xl font-semibold tracking-tight">{title}</h3>
            {price && (
              <div className="space-y-1">
                <span className="text-5xl font-bold tracking-tight">{price}</span>
                <p className="text-base text-muted-foreground/80">
                  {priceDescription}
                </p>
              </div>
            )}
          </div>
          {imageSrc && (
            <div className="shrink-0 overflow-hidden rounded-xl">
              <img
                src={imageSrc}
                alt={imageAlt || title}
                width={96}
                height={96}
                className="h-24 w-24 object-cover transition-transform duration-500 group-hover:scale-110"
              />
            </div>
          )}
        </div>

        <p className="text-base leading-relaxed text-muted-foreground/80 min-h-[80px]">
          {description}
        </p>

        {features && (
          <ul className="space-y-4 pt-4">
            {features.map((feature, index) => (
              <li key={index} className="flex items-center gap-3">
                {useSparkles ? (
                  <Sparkles className="h-5 w-5 text-primary" />
                ) : (
                  <Diamond className="h-5 w-5 text-primary" />
                )}
                <span className="text-base">{feature}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-10 pt-6">
        <Button 
          size="lg" 
          className="w-full text-base font-semibold"
          variant={isHovered ? "default" : "outline"}
        >
          {buttonText}
        </Button>
      </div>
    </div>
  );
}

export default function PricingSection() {
  const plans = [
    {
      title: "Starter",
      price: "€500",
      priceDescription: "Starting from",
      description:
        "Perfect for small projects and simple websites that need a professional touch.",
      features: [
        "Experienced Designer",
        "Fast Delivery",
        "Responsive Design",
        "Basic SEO Setup",
      ],
      buttonText: "Get Started",
      imageSrc: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=400&q=80",
      imageAlt: "Ocean waves",
    },
    {
      title: "Professional",
      price: "€1000",
      priceDescription: "Starting from",
      description:
        "Ideal for businesses that need a complete website with advanced features and functionality.",
      features: [
        "Experienced Designer",
        "Fast Delivery",
        "Conversion Focused",
        "Advanced Animations",
      ],
      buttonText: "Get Started",
      imageSrc: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80",
      imageAlt: "Mountain landscape",
    },
    {
      title: "Enterprise",
      price: "€1500+",
      priceDescription: "Starting from",
      description:
        "For complex projects requiring custom development, integrations, and ongoing support.",
      features: [
        "Dedicated Design Team",
        "Priority Support",
        "Custom Development",
        "Full Design System",
      ],
      buttonText: "Contact Sales",
      imageSrc: "https://images.unsplash.com/photo-1533227268428-f9ed0900fb3b?w=400&q=80",
      imageAlt: "Premium design",
      useSparkles: true,
    },
  ];

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background py-20">
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-accent/5 blur-[100px]" />
      </div>
      
      <div className="container mx-auto px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-16 text-center">
          <div className="space-y-6">
            <p className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              Pricing Plans
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Transparent Pricing, No Surprises
            </h1>
            <p className="text-xl leading-relaxed text-muted-foreground/80 max-w-2xl mx-auto">
              Choose the perfect plan for your needs. All plans include our core features with no hidden fees.
            </p>
          </div>
        </div>

        <div className="mt-20 grid grid-cols-1 gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <PricingCard key={plan.title} {...plan} />
          ))}
        </div>

        <div className="mx-auto mt-20 max-w-2xl rounded-2xl border border-border/50 bg-card/30 p-10 text-center backdrop-blur-sm">
          <div className="space-y-4">
            <h3 className="text-2xl font-semibold">Unique Request</h3>
            <p className="text-lg text-muted-foreground/80">
              Looking for something custom? Let us help you build exactly what you need.
            </p>
            <div className="pt-4">
              <Button size="lg" variant="outline">
                Let us Talk
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}