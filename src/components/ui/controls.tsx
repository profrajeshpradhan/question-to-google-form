"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CheckIcon, MoreVerticalIcon } from "./icons";
import { cx } from "./primitives";

export const inputClass =
  "block w-full rounded-xl border border-line bg-white px-3.5 text-ink shadow-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 aria-[invalid=true]:border-danger-600";

/** Borderless round icon button (Google Forms style) with an accessible name. */
export function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-600 transition-colors disabled:cursor-not-allowed disabled:opacity-30",
        danger ? "hover:bg-danger-50 hover:text-danger-600" : "hover:bg-gray-100 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

/** Material-style on/off switch. */
export function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <input
      type="checkbox"
      role="switch"
      aria-label={label}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="relative h-3.5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-gray-300 transition-colors before:absolute before:-top-[3px] before:left-0 before:h-5 before:w-5 before:rounded-full before:bg-white before:shadow-[0_1px_3px_rgb(0_0_0/0.35)] before:transition-transform checked:bg-brand-200 checked:before:translate-x-4 checked:before:bg-brand-600 focus-visible:outline-offset-4"
    />
  );
}

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  /** Shows a check mark (menuitemcheckbox / menuitemradio). */
  checked?: boolean;
  role?: "menuitem" | "menuitemcheckbox" | "menuitemradio";
  disabled?: boolean;
}

/**
 * Popup menu (⋮ menus and the field-type picker). Closes on selection, outside
 * click and Escape; arrow keys move between items.
 */
export function Menu({
  label,
  items,
  trigger,
  triggerClassName,
  align = "right",
}: {
  label: string;
  items: MenuItem[];
  /** Custom trigger content; defaults to a ⋮ icon. */
  trigger?: ReactNode;
  triggerClassName?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    root.current?.querySelector<HTMLElement>('[role^="menuitem"]:not([disabled])')?.focus();
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      root.current?.querySelector<HTMLElement>("[aria-haspopup]")?.focus();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const list = [...(root.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])') ?? [])];
    const at = list.indexOf(document.activeElement as HTMLElement);
    list[(at + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length]?.focus();
  };

  return (
    <div ref={root} className="relative" onKeyDown={onKeyDown}>
      <button
        type="button"
        aria-label={label}
        title={trigger ? undefined : label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={
          triggerClassName ??
          "inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 hover:text-ink"
        }
      >
        {trigger ?? <MoreVerticalIcon size={20} />}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className={cx(
            "absolute z-30 mt-1 min-w-[14rem] overflow-hidden rounded-lg border border-line bg-white py-2 shadow-pop",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role={item.role ?? (item.checked === undefined ? "menuitem" : "menuitemcheckbox")}
              aria-checked={item.checked === undefined ? undefined : item.checked}
              disabled={item.disabled}
              onClick={() => {
                item.onSelect();
                setOpen(false);
              }}
              className={cx(
                "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-ink hover:bg-gray-100 focus:bg-gray-100 focus:outline-none disabled:opacity-40",
                item.checked && item.role === "menuitemradio" && "bg-brand-50",
              )}
            >
              {item.icon && <span className="text-gray-600">{item.icon}</span>}
              <span className="flex-1">{item.label}</span>
              {item.checked && item.role !== "menuitemradio" && <CheckIcon size={16} className="text-brand-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
