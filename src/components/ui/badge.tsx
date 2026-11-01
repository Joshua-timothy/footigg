import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/15 text-primary",
        secondary: "border-transparent bg-white/[0.06] text-muted-foreground",
        outline: "border-white/10 text-muted-foreground",
        yes: "border-yes/25 bg-yes/10 text-yes",
        no: "border-no/25 bg-no/10 text-no",
        warning: "border-amber-400/25 bg-amber-400/10 text-amber-300",
        muted: "border-transparent bg-white/[0.04] text-muted-foreground/80",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
