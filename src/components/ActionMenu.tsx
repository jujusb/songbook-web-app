"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface ActionItem {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "default" | "destructive";
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface ActionMenuProps {
  items: ActionItem[];
  triggerLabel?: string;
  triggerIcon?: React.ReactNode;
  position?: "bottom" | "top" | "right";
}

export function ActionMenu({
  items,
  triggerLabel = "Actions",
  triggerIcon,
  position = "bottom",
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        if (triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
          setOpen(false);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", handleEscape);
    }
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  const menuContent = (
    <div
      ref={menuRef}
      className={`
        fixed z-50 min-w-[180px] max-w-[90vw] rounded-lg border border-neutral-200 dark:border-neutral-700
        bg-white dark:bg-neutral-900 shadow-lg overflow-hidden
        ${isMobile 
          ? "bottom-0 left-0 right-0 rounded-t-lg rounded-b-none border-t border-neutral-200 dark:border-neutral-700"
          : position === "bottom" 
            ? "bottom-4 left-1/2 -translate-x-1/2" 
            : "top-4 right-4"
        }
      `}
      role="menu"
    >
      {items.map((item, index) => (
        <button
          key={index}
          onClick={() => {
            item.onClick?.();
            setOpen(false);
          }}
          disabled={item.disabled}
          className={`
            w-full px-4 py-3 text-left text-sm flex items-center gap-3
            ${item.variant === "destructive"
              ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
              : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            }
            ${item.disabled ? "opacity-50 cursor-not-allowed" : ""}
          `}
          role="menuitem"
        >
          {item.icon && <span className="w-5 h-5 flex-shrink-0">{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1.5 touch-manipulation"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {triggerIcon || (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        )}
        {triggerLabel && <span className="hidden sm:inline">{triggerLabel}</span>}
      </button>
      {open && createPortal(menuContent, document.body)}
    </div>
  );
}
