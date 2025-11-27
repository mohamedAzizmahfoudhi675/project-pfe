import React from "react";
export default function ArrowIcon({ color = "#06b6d4", style }) {
  return (
    <svg width="24" height="16" viewBox="0 0 24 16" style={style}>
      <path
        d="M2 8 L20 8 M16 4 L20 8 L16 12"
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}