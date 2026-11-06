import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"

const progressVariants = cva(
  "h-full w-full flex-1 bg-primary transition-all",
  {
    variants: {
      variant: {
        default: "bg-primary",
        success: "bg-success",
        warning: "bg-warning",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface ProgressIndicatorProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Indicator>,
    VariantProps<typeof progressVariants> {}

const ProgressIndicator = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Indicator>,
  ProgressIndicatorProps
>(({ className, variant, ...props }, ref) => (
  <ProgressPrimitive.Indicator
    ref={ref}
    className={cn(progressVariants({ variant }), className)}
    {...props}
  />
))
ProgressIndicator.displayName = ProgressPrimitive.Indicator.displayName

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> &
    VariantProps<typeof progressVariants>
>(({ className, value, variant, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
      className
    )}
    {...props}
  >
    <ProgressIndicator
      variant={variant}
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress, ProgressIndicator, progressVariants }
