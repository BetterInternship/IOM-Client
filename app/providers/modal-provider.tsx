"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

type ModalOptions = {
  allowBackdropClick?: boolean;
  closeOnEsc?: boolean;
  hasClose?: boolean;
  title?: React.ReactNode;
  description?: string;
  headerClassName?: string;
  panelClassName?: string;
  contentClassName?: string;
  backdropClassName?: string;
  showHeaderDivider?: boolean;
  useCustomPanel?: boolean;
  exitAnimation?: "default" | "fade";
  onClose?: () => void;
};

type OpenModalCallback = (
  name: string,
  contentNode: React.ReactNode,
  options?: ModalOptions
) => void;
type CloseModalCallback = (name?: string, options?: { skipOnClose?: boolean }) => void;

const ModalCtx = createContext<{ openModal: OpenModalCallback; closeModal: CloseModalCallback }>({
  openModal: () => {},
  closeModal: () => {},
});

type ActiveModalRegistryEntry = { contentNode: React.ReactNode; options: ModalOptions };

export const useModal = () => useContext(ModalCtx);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [activeModalRegistry, setActiveModalRegistry] = useState<
    Record<string, ActiveModalRegistryEntry>
  >({});
  const [portalActive, setPortalActive] = useState(false);
  // Always-current mirror of activeModalRegistry for onExitComplete below —
  // that callback can fire long after it was created (a background tab's
  // rAF-driven exit animation is paused while hidden and only resumes on
  // refocus), so the render it closed over can be stale by the time it
  // runs. Mutating a ref during render like this is safe as long as it's
  // never read during render itself, only from callbacks/effects.
  const activeModalRegistryRef = useRef(activeModalRegistry);
  activeModalRegistryRef.current = activeModalRegistry;

  const openModal = useCallback<OpenModalCallback>((name, content, opts = {}) => {
    setActiveModalRegistry((m) => ({ ...m, [name]: { contentNode: content, options: opts } }));
  }, []);

  const closeModal = useCallback<CloseModalCallback>((name, closeOptions) => {
    setActiveModalRegistry((m) => {
      if (!name) {
        if (!closeOptions?.skipOnClose) {
          Object.values(m).forEach((e) => e.options.onClose?.());
        }
        return {};
      }

      const entry = m[name];
      if (!closeOptions?.skipOnClose) entry?.options.onClose?.();
      const { [name]: _removed, ...rest } = m;
      return rest;
    });
  }, []);

  useEffect(() => {
    if (Object.keys(activeModalRegistry).length > 0) setPortalActive(true);
  }, [activeModalRegistry]);

  useEffect(() => {
    const count = Object.keys(activeModalRegistry).length;
    if (count === 0) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [activeModalRegistry]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const entries = Object.entries(activeModalRegistry);
      if (!entries.length) return;
      const [lastName, lastEntry] = entries[entries.length - 1];
      if (lastEntry.options.closeOnEsc !== false) closeModal(lastName);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [activeModalRegistry, closeModal]);

  const portals = useMemo(() => {
    const entries = Object.entries(activeModalRegistry);
    if (!portalActive) return null;

    return createPortal(
      <AnimatePresence
        onExitComplete={() => {
          // A stale "the registry was empty" snapshot here would
          // unconditionally drop portalActive and tear down the whole
          // portal — including a new modal opened since this callback was
          // created — so this reads the ref rather than the closed-over
          // activeModalRegistry from whichever render created it.
          if (Object.keys(activeModalRegistryRef.current).length === 0) {
            setPortalActive(false);
          }
        }}
      >
        {entries.map(([name, { contentNode, options }]) => (
          <ModalWrapper key={name} name={name} options={options} close={closeModal}>
            {contentNode}
          </ModalWrapper>
        ))}
      </AnimatePresence>,
      document.body
    );
  }, [activeModalRegistry, closeModal, portalActive]);

  return (
    <ModalCtx.Provider value={{ openModal, closeModal }}>
      {children}
      {portals}
    </ModalCtx.Provider>
  );
}

const ModalWrapper = ({
  name,
  children,
  options,
  close,
}: {
  name: string;
  children: React.ReactNode;
  options: ModalOptions;
  close: (name?: string) => void;
}) => {
  const backdropRef = React.createRef<HTMLDivElement>();
  const fadeExit = options.exitAnimation === "fade";

  const handleBackdropClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (options.allowBackdropClick === false) return;
    if (e.target === backdropRef.current) close(name);
  };

  return (
    <motion.div
      key={name}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={fadeExit ? { duration: 0.5, ease: [0.22, 1, 0.36, 1] } : undefined}
      className={cn(
        "fixed inset-0 z-[1000] bg-black/10 backdrop-blur-sm",
        "flex items-end justify-center p-0",
        "sm:items-center sm:justify-center sm:p-4",
        options.backdropClassName ?? ""
      )}
      ref={backdropRef}
      role="dialog"
      aria-modal="true"
      onClick={handleBackdropClick}
      onTouchEnd={handleBackdropClick}
    >
      {!options?.useCustomPanel ? (
        <motion.div
          initial={fadeExit ? { opacity: 0, y: 8, scale: 0.98, filter: "blur(4px)" } : { opacity: 0, y: 24, scale: 0.98 }}
          animate={fadeExit ? { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" } : { opacity: 1, y: 0, scale: 1 }}
          exit={fadeExit ? { opacity: 0, y: -10, scale: 0.985, filter: "blur(8px)" } : { opacity: 0, y: 16, scale: 0.98 }}
          transition={
            fadeExit
              ? { duration: 0.58, ease: [0.16, 1, 0.3, 1] }
              : {
                  type: "spring",
                  stiffness: 320,
                  damping: 28,
                  mass: 0.8,
                }
          }
          className={[
            "relative overflow-hidden border bg-white shadow-2xl",
            "w-full max-w-full min-w-[100svw] rounded-t-[0.33em] rounded-b-none",
            "max-h-dvh",
            "sm:max-h-[90vh] sm:w-auto sm:max-w-2xl sm:min-w-sm sm:rounded-[0.33em]",
            options.panelClassName ?? "",
          ].join(" ")}
          onClick={(e) => e.stopPropagation()}
        >
          {(options.title || options.hasClose !== false) && (
            <div
              className={cn(
                "flex items-start justify-between gap-3 px-4 py-3",
                options.showHeaderDivider ? "border-b" : "",
                options.headerClassName ?? ""
              )}
            >
              {options.title ? (
                typeof options.title === "string" ? (
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg leading-snug font-semibold tracking-tight sm:text-2xl">
                      {options.title}
                    </h2>
                    {options.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{options.description}</p>
                    )}
                  </div>
                ) : (
                  <div className="min-w-0 flex-1">
                    {options.title}
                    {options.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{options.description}</p>
                    )}
                  </div>
                )
              ) : (
                <div className="flex-1" />
              )}
              {options.hasClose !== false && (
                <button
                  aria-label="Close"
                  onClick={() => close(name)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200"
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              )}
            </div>
          )}

          <div className={!options.hasClose ? "pt-3" : ""}>
            <div
              className={
                options.contentClassName ??
                "max-h-[calc(100dvh-6rem)] overflow-x-hidden overflow-y-auto px-4 pb-4 sm:max-h-[calc(90vh-4rem)] sm:overflow-auto"
              }
            >
              {children}
            </div>
          </div>

          <div className="pb-safe h-4 sm:hidden" />
        </motion.div>
      ) : (
        children
      )}
    </motion.div>
  );
};
