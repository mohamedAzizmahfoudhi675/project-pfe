// File: src/components/WaypointParamsModal.jsx
import React, { useEffect, useRef, useState } from "react";
import WaypointParamsPanel from "./WaypointParamsPanel";

/*
 Minimal inline comments only for important bits.
*/

export default function WaypointParamsModal({
  waypoint,
  routeParams,
  onSave,
  onCancel,
  actionIcons = {},
  compact = false,
}) {
  const [params, setParams] = useState(waypoint);
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);
  const previousActiveRef = useRef(null);

  useEffect(() => setParams(waypoint), [waypoint]);

  // Lock body scroll while open
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = original; };
  }, []);

  // Focus management: save previous focus and move focus to dialog
  useEffect(() => {
    previousActiveRef.current = document.activeElement;
    // Focus first focusable in dialog after mount
    const t = setTimeout(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      (focusable || dialog).focus();
    }, 0);
    return () => {
      clearTimeout(t);
      if (previousActiveRef.current && previousActiveRef.current.focus) {
        previousActiveRef.current.focus();
      }
    };
  }, []);

  // Close when clicking overlay (but not when clicking dialog)
  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) {
      onCancel?.();
    }
  };

  // Keyboard handler: Escape to close; Tab trap inside modal
  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onCancel?.();
      return;
    }

    if (e.key === "Tab") {
      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll(
          'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);

      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 flex items-center justify-center bg-black/40 z-50"
      role="presentation"
      onMouseDown={handleOverlayClick}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="waypoint-modal-title"
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()} // keep clicks inside dialog from closing
        className="bg-blue-950 rounded-xl shadow-xl p-6 w-[440px] max-w-[95vw] max-h-[90vh] overflow-y-auto outline-none"
      >
        <div className="flex items-start justify-between">
          <h3 id="waypoint-modal-title" className="text-lg font-semibold text-white">
            {params?.name ? `Waypoint — ${params.name}` : "Waypoint Settings"}
          </h3>
          <button
            aria-label="Close"
            onClick={() => onCancel?.()}
            className="ml-4 text-gray-300 hover:text-white rounded p-1"
          >
            ✕
          </button>
        </div>

        <div className="mt-4">
          <WaypointParamsPanel
            params={params}
            routeParams={routeParams}
            onChange={setParams}
            actionIcons={actionIcons}
            compact={compact}
          />
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            onClick={() => onCancel?.()}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            onClick={() => onSave?.(params)}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
