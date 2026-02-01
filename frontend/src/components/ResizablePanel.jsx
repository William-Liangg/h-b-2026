import { useState, useRef, useEffect } from "react";

/**
 * ResizablePanel - A panel that can be resized by dragging a handle
 *
 * @param {Object} props
 * @param {string} props.direction - 'horizontal' or 'vertical' (determines resize direction)
 * @param {number} props.defaultSize - Default size in pixels
 * @param {number} props.minSize - Minimum size in pixels (default: 200)
 * @param {number} props.maxSize - Maximum size in pixels (default: Infinity)
 * @param {string} props.className - Additional CSS classes
 * @param {React.ReactNode} props.children - Panel content
 * @param {string} props.handlePosition - 'right', 'left', 'top', or 'bottom' (where to place resize handle)
 */
export default function ResizablePanel({
  direction = "horizontal",
  defaultSize = 300,
  minSize = 200,
  maxSize = Infinity,
  className = "",
  children,
  handlePosition = "right",
}) {
  const [size, setSize] = useState(defaultSize);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef(null);
  const startPosRef = useRef(0);
  const startSizeRef = useRef(0);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsResizing(true);
    startPosRef.current = direction === "horizontal" ? e.clientX : e.clientY;
    startSizeRef.current = size;
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;

      const currentPos = direction === "horizontal" ? e.clientX : e.clientY;
      let delta = currentPos - startPosRef.current;

      // Adjust delta based on handle position
      if (handlePosition === "left" || handlePosition === "top") {
        delta = -delta;
      }

      const newSize = Math.max(
        minSize,
        Math.min(maxSize, startSizeRef.current + delta),
      );
      setSize(newSize);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor =
        direction === "horizontal" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, direction, minSize, maxSize, handlePosition, size]);

  const sizeStyle =
    direction === "horizontal"
      ? { width: `${size}px` }
      : { height: `${size}px` };

  const handleStyle = {
    position: "absolute",
    ...(handlePosition === "right" && {
      right: 0,
      top: 0,
      bottom: 0,
      width: "4px",
      cursor: "col-resize",
    }),
    ...(handlePosition === "left" && {
      left: 0,
      top: 0,
      bottom: 0,
      width: "4px",
      cursor: "col-resize",
    }),
    ...(handlePosition === "bottom" && {
      bottom: 0,
      left: 0,
      right: 0,
      height: "4px",
      cursor: "row-resize",
    }),
    ...(handlePosition === "top" && {
      top: 0,
      left: 0,
      right: 0,
      height: "4px",
      cursor: "row-resize",
    }),
    zIndex: 10,
  };

  return (
    <div
      ref={panelRef}
      className={`relative flex-shrink-0 ${className}`}
      style={sizeStyle}
    >
      {children}
      <div
        onMouseDown={handleMouseDown}
        style={handleStyle}
        className="hover:bg-cyan-500/50 active:bg-cyan-500 transition-colors"
      />
    </div>
  );
}
