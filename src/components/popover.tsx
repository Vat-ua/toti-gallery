"use client";

import * as Primitive from "@radix-ui/react-popover";
import { useId, type ReactElement, type ReactNode } from "react";
import { focusOverlayTarget, overlayPosition, useOverlayContainer } from "./overlay-utils";

type Props = {
  trigger: ReactElement;
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
  id?: string;
  label?: string;
  labelledBy?: string;
  initialFocus?: string;
  scrollInitialFocus?: boolean;
};

export function Popover({ trigger, children, open, onOpenChange, className = "", id, label, labelledBy, initialFocus, scrollInitialFocus }: Props) {
  const { setTrigger, container } = useOverlayContainer();
  const generatedId = useId();
  const contentId = id ?? generatedId;
  return <Primitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
    <Primitive.Trigger asChild ref={setTrigger} aria-controls={contentId}>{trigger}</Primitive.Trigger>
    <Primitive.Portal container={container}>
      <Primitive.Content id={contentId} className={`dropdown-menu ${className}`}
        aria-label={label} aria-labelledby={labelledBy} {...overlayPosition}
        onOpenAutoFocus={event => focusOverlayTarget(event, initialFocus, scrollInitialFocus)}>
        {children}
      </Primitive.Content>
    </Primitive.Portal>
  </Primitive.Root>;
}
