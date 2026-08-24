"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, PenLine, Send } from "lucide-react";

import {
  MoaSignatureInput,
  type MoaSignatureMode,
} from "@/components/moa-signature-input";
import { SignatoryCard } from "@/components/signatory-card";
import { SignatoryEmailInput } from "@/components/signatory-email-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CompanySignerMode = "self" | "delegate";

function CompanySignerForm({
  mode,
  onModeChange,
  onModeChangingChange,
  repName,
  onRepNameChange,
  repTitle,
  onRepTitleChange,
  signatureMode,
  onSignatureModeChange,
  signatureText,
  onSignatureTextChange,
  signatureFile,
  onSignatureFileChange,
  signatoryEmail,
  onSignatoryEmailChange,
}: {
  mode: CompanySignerMode | null;
  onModeChange: (mode: CompanySignerMode | null) => void;
  onModeChangingChange?: (isChanging: boolean) => void;
  repName: string;
  onRepNameChange: (value: string) => void;
  repTitle: string;
  onRepTitleChange: (value: string) => void;
  signatureMode: MoaSignatureMode;
  onSignatureModeChange: (mode: MoaSignatureMode) => void;
  signatureText: string;
  onSignatureTextChange: (value: string) => void;
  signatureFile: File | null;
  onSignatureFileChange: (file: File | null) => void;
  signatoryEmail: string;
  onSignatoryEmailChange: (value: string) => void;
}) {
  const [isChangingMode, setIsChangingMode] = useState(false);

  function chooseMode(nextMode: CompanySignerMode) {
    setIsChangingMode(false);
    onModeChangingChange?.(false);
    onModeChange(nextMode);
  }

  function changeMode() {
    setIsChangingMode(true);
    onModeChangingChange?.(true);
  }

  return (
    <div className="space-y-4">
      {mode ? (
        <button
          type="button"
          onClick={changeMode}
          aria-label="Change signer"
          className="flex h-12 w-full items-center gap-3 rounded-[0.33em] border border-primary bg-primary/5 px-4 text-left"
        >
          <span className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
            {mode === "self" ? (
              <PenLine className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </span>
          <span className="font-semibold text-gray-900">
            {mode === "self"
              ? "I'll sign it myself"
              : "Send it to someone else to sign"}
          </span>
          <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
        </button>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => chooseMode("self")}
            className="flex cursor-pointer flex-col items-start gap-3 rounded-[0.33em] border border-gray-200 p-5 text-left transition-colors hover:border-gray-300"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-muted-foreground">
              <PenLine className="h-8 w-8" />
            </span>
            <span className="text-base font-semibold text-gray-900">
              I'll sign it myself
            </span>
            <span className="text-muted-foreground text-sm">
              Enter your name, title, and signature now.
            </span>
          </button>
          <button
            type="button"
            onClick={() => chooseMode("delegate")}
            className="flex cursor-pointer flex-col items-start gap-3 rounded-[0.33em] border border-gray-200 p-5 text-left transition-colors hover:border-gray-300"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-muted-foreground">
              <Send className="h-8 w-8" />
            </span>
            <span className="text-base font-semibold text-gray-900">
              Send it to someone else in the company
            </span>
            <span className="text-muted-foreground text-sm">
              We'll email them a link to sign the MOA.
            </span>
          </button>
        </div>
      )}

      <AnimatePresence
        initial={false}
        mode="wait"
        onExitComplete={() => {
          if (isChangingMode) {
            onModeChange(null);
            setIsChangingMode(false);
            onModeChangingChange?.(false);
          }
        }}
      >
        {mode && !isChangingMode && (
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            {mode === "self" ? (
              <SignatoryCard>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="mt-0.5" htmlFor="rep-name">
                      Name
                    </Label>
                    <Input
                      id="rep-name"
                      value={repName}
                      onChange={(event) => onRepNameChange(event.target.value)}
                      placeholder="Full name"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="mt-0.5" htmlFor="rep-title">
                      Title
                    </Label>
                    <Input
                      id="rep-title"
                      value={repTitle}
                      onChange={(event) => onRepTitleChange(event.target.value)}
                      placeholder="e.g. CEO, HR Manager"
                    />
                  </div>
                </div>

                <MoaSignatureInput
                  mode={signatureMode}
                  onModeChange={onSignatureModeChange}
                  text={signatureText}
                  onTextChange={onSignatureTextChange}
                  file={signatureFile}
                  onFileChange={onSignatureFileChange}
                />
              </SignatoryCard>
            ) : (
              <SignatoryEmailInput
                id="signatory-email"
                value={signatoryEmail}
                onChange={onSignatoryEmailChange}
                suggestions={[]}
                required
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export { CompanySignerForm, type CompanySignerMode };
