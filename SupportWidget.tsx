"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const SupportWidgetPanel = dynamic(
  () => import("./SupportWidgetPanel"),
  { ssr: false }
);

export default function SupportWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && (
        <SupportWidgetPanel
          initialOpen
          onClose={() => setOpen(false)}
        />
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? "Close GoWishlist Support" : "Contact GoWishlist Support"}
        title="GoWishlist Support"
        style={{
          position: "fixed",
          right: "20px",
          bottom: "20px",
          width: "58px",
          height: "58px",
          borderRadius: "50%",
          border: "none",
          background: "#2563eb",
          color: "#ffffff",
          boxShadow: "0 12px 30px rgba(37,99,235,0.35)",
          cursor: "pointer",
          zIndex: 2147483001,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
        }}
      >
        {open ? (
          <span
            style={{
              fontSize: "26px",
              lineHeight: "1",
              fontWeight: "500",
            }}
          >
            ×
          </span>
        ) : (
          <svg
            width="27"
            height="27"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M20 11.5C20 15.6421 16.1944 19 11.5 19C10.4642 19 9.4717 18.8365 8.55309 18.5367L4 20L5.42359 16.3822C3.92199 15.1049 3 13.3923 3 11.5C3 7.35786 6.80558 4 11.5 4C16.1944 4 20 7.35786 20 11.5Z"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M8 11.5H8.01M11.5 11.5H11.51M15 11.5H15.01"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>
    </>
  );
}
