"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Tooltip({
  children,
  content,
  className,
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  className?: string;
}) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative inline-block">
      <div onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
        {children}
      </div>
      {show && (
        <div
          className={cn(
            "absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-xs text-white",
            className
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}
