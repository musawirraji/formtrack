import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Card.module.scss";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Applies the accent glow border — use sparingly, for the primary card on a screen. */
  glow?: boolean;
  /** Removes default padding (useful when a card contains its own table or chart). */
  flush?: boolean;
  children?: ReactNode;
}

export function Card({
  glow = false,
  flush = false,
  className,
  children,
  ...rest
}: CardProps) {
  const classes = [
    styles.card,
    glow && styles.glow,
    flush && styles.flush,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
