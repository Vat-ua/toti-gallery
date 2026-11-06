"use client";

import * as Primitive from "@radix-ui/react-dropdown-menu";
import type { ReactElement, ReactNode } from "react";
import { focusOverlayTarget, overlayPosition, useOverlayContainer } from "./overlay-utils";

type Props = {
  trigger: ReactElement;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  initialFocus?: string;
};

export function DropdownMenu({ trigger, children, open, onOpenChange, className = "", initialFocus }: Props) {
  const { setTrigger, container } = useOverlayContainer();
  return <Primitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
    <Primitive.Trigger asChild ref={setTrigger}>{trigger}</Primitive.Trigger>
    <Primitive.Portal container={container}>
      <Primitive.Content className={`dropdown-menu ${className}`} {...overlayPosition}
        loop onFocus={event => {
          if (event.target === event.currentTarget) focusOverlayTarget(event, initialFocus, true);
        }}>
        {children}
      </Primitive.Content>
    </Primitive.Portal>
  </Primitive.Root>;
}

export const DropdownItem = Primitive.Item;
export const DropdownLabel = Primitive.Label;
export const DropdownRadioGroup = Primitive.RadioGroup;
export const DropdownRadioItem = Primitive.RadioItem;
export const DropdownItemIndicator = Primitive.ItemIndicator;
