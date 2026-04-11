import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Badge.module.scss";

type Tone = "neutral" | "accent" | "positive" | "negative" | "amber";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  children?: ReactNode;
}

export function Badge({
  tone = "neutral",
  className,
  children,
  ...rest
}: BadgeProps) {
  const classes = [styles.badge, styles[`t-${tone}`], className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}
