import { useMemo, useCallback, useState, memo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// Custom node component for Obsidian-style appearance
function OnboardingNode({ data, selected }) {
  const [textExpanded, setTextExpanded] = useState(false);
  const [labelExpanded, setLabelExpanded] = useState(false);
  const isExpanded = data.isExpanded;
  const isMainNode = data.isMainNode;
  const isSubNode = data.isSubNode;
  const isBacklink = data.isBacklink;
  const isAuxiliary = data.isAuxiliary;

  // Toggle text expansion
  const toggleTextExpand = (e) => {
    e.stopPropagation();
    setTextExpanded(!textExpanded);
  };

  // Toggle label expansion on double click
  const toggleLabelExpand = (e) => {
    e.stopPropagation();
    setLabelExpanded(!labelExpanded);
  };

  // Determine background gradient based on node type
  const getBackground = () => {
    if (isAuxiliary) {
      return "linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)"; // Purple for Atlas insights
    }
    if (isBacklink) {
      return "linear-gradient(135deg, #78350f 0%, #d97706 100%)"; // Amber for backlinks
    }
    if (isSubNode) {
      return "linear-gradient(135deg, #0c4a6e 0%, #0e7490 100%)";
    }
    if (isExpanded) {
      return "linear-gradient(135deg, #0e7490 0%, #22d3ee 100%)";
    }
    return "linear-gradient(135deg, #18181b 0%, #27272a 100%)";
  };

  // Determine box shadow based on node type
  const getBoxShadow = () => {
    if (isAuxiliary) {
      return "0 4px 20px rgba(139, 92, 246, 0.35)";
    }
    if (isBacklink) {
      return "0 4px 20px rgba(217, 119, 6, 0.35)";
    }
    if (isExpanded) {
      return "0 0 30px rgba(34, 211, 238, 0.3), 0 0 60px rgba(34, 211, 238, 0.15)";
    }
    if (isSubNode) {
      return "0 4px 20px rgba(6, 182, 212, 0.25)";
    }
    return "0 4px 20px rgba(0, 0, 0, 0.3)";
  };

  // Get type badge color
  const getTypeBadgeColor = () => {
    if (isAuxiliary) return "text-purple-300";
    if (isBacklink) return "text-amber-300";
    return "text-cyan-300";
  };

  return (
    <div
      className={`
        relative rounded-xl transition-all duration-300 cursor-pointer
        ${isMainNode ? "min-w-[200px]" : "min-w-[160px] max-w-[200px]"}
        ${selected ? "ring-2 ring-cyan-400 ring-offset-2 ring-offset-zinc-950" : ""}
        ${isExpanded ? "scale-105" : ""}
      `}
      style={{
        background: getBackground(),
        boxShadow: getBoxShadow(),
      }}
    >
      {/* Top handle for incoming connections */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-cyan-500 !border-cyan-300 !w-3 !h-3"
      />

      <div className={`${isMainNode ? "p-4" : "p-3"}`}>
        {/* Step indicator */}
        {isMainNode && data.stepNumber && (
          <div className="absolute -top-3 -left-3 w-7 h-7 rounded-full bg-cyan-600 border-2 border-cyan-300 flex items-center justify-center text-xs font-bold text-zinc-950 shadow-lg">
            {data.stepNumber}
          </div>
        )}

        {/* Auxiliary/Backlink indicator icons */}
        {isAuxiliary && (
          <div
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center text-[10px] text-white shadow-lg"
            title="Atlas Insight"
          >
            ✨
          </div>
        )}
        {isBacklink && (
          <div
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-[10px] text-white shadow-lg"
            title="Linked File"
          >
            🔗
          </div>
        )}

        {/* File name / Label */}
        <div
          onDoubleClick={toggleLabelExpand}
          className={`font-semibold text-white ${isMainNode ? "text-sm" : "text-xs"} mb-1 cursor-pointer`}
          title={
            labelExpanded
              ? "Double-click to collapse"
              : "Double-click to expand"
          }
        >
          <span className={labelExpanded ? "" : "truncate block"}>
            {data.label}
          </span>
        </div>

        {/* Summary for main nodes - clickable to expand */}
        {isMainNode && data.summary && (
          <div
            onClick={toggleTextExpand}
            className={`text-xs text-zinc-300 leading-relaxed cursor-pointer hover:text-zinc-100 transition-colors ${
              textExpanded ? "" : "line-clamp-2"
            }`}
            title={textExpanded ? "Click to collapse" : "Click to expand"}
          >
            {data.summary}
          </div>
        )}

        {/* Description for auxiliary nodes - clickable to expand */}
        {isAuxiliary && data.description && (
          <div
            onClick={toggleTextExpand}
            className={`text-[10px] text-purple-200 leading-relaxed mt-1 cursor-pointer hover:text-purple-100 transition-colors ${
              textExpanded ? "" : "line-clamp-2"
            }`}
            title={textExpanded ? "Click to collapse" : "Click to expand"}
          >
            {data.description}
            {!textExpanded && data.description.length > 60 && (
              <span className="text-purple-400 ml-1">▼</span>
            )}
            {textExpanded && <span className="text-purple-400 ml-1">▲</span>}
          </div>
        )}

        {/* Sub-node type indicator */}
        {isSubNode && data.type && (
          <div
            className={`text-[10px] ${getTypeBadgeColor()} uppercase tracking-wide mt-1 flex items-center gap-1`}
          >
            {data.icon && <span>{data.icon}</span>}
            {isBacklink && !data.icon && <span>→</span>}
            {data.type}
          </div>
        )}

        {/* Target file for backlinks */}
        {isBacklink && data.targetFile && (
          <div className="text-[9px] text-amber-200 mt-1 truncate opacity-75">
            {data.targetFile}
          </div>
        )}

        {/* Dependencies count for main nodes */}
        {isMainNode && data.dependencies && data.dependencies.length > 0 && (
          <div className="mt-2 text-[10px] text-amber-400 flex items-center gap-1">
            <span>🔗</span>
            <span>{data.dependencies.length} dependencies</span>
          </div>
        )}

        {/* Expand hint */}
        {isMainNode && data.hasChildren && !isExpanded && (
          <div className="mt-2 text-[10px] text-cyan-400 flex items-center gap-1">
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
            Click to explore
          </div>
        )}
      </div>

      {/* Bottom handle for outgoing connections */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-cyan-500 !border-cyan-300 !w-3 !h-3"
      />

      {/* Side handles for sub-node connections */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!bg-cyan-600 !border-cyan-400 !w-2 !h-2"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!bg-cyan-600 !border-cyan-400 !w-2 !h-2"
      />
    </div>
  );
}

const nodeTypes = {
  onboarding: OnboardingNode,
};

// Infer export type from naming conventions
function inferExportType(name) {
  if (!name || typeof name !== "string") return { type: "Export", icon: "📦" };

  // React hooks (useXxx)
  if (/^use[A-Z]/.test(name)) {
    return { type: "Hook", icon: "🪝" };
  }
  // Constants (UPPER_CASE or UPPER_SNAKE_CASE)
  if (/^[A-Z][A-Z0-9_]+$/.test(name)) {
    return { type: "Constant", icon: "🔒" };
  }
  // Classes/Components (PascalCase, 2+ capitals or ends with common suffixes)
  if (
    /^[A-Z][a-zA-Z0-9]*(?:Component|Provider|Context|Service|Manager|Handler|Controller|Factory|Builder|Store|Model|View|Page|Screen|Modal|Dialog|Form|Button|Input|Card|List|Item|Panel|Layout|Wrapper|Container|Router|Middleware|Plugin|Adapter|Client|Server|Worker|Queue|Cache|Logger|Config|Utils?|Helper|Validator|Parser|Formatter|Converter|Mapper|Reducer|Selector|Action|Slice|Saga|Thunk|Effect|Observer|Listener|Subscriber|Publisher|Emitter|Stream|Channel|Socket|Connection|Session|Auth|User|Admin|Api|Db|Sql|Http|Rest|Grpc|Graphql)$/.test(
      name,
    )
  ) {
    return { type: "Class", icon: "🏛️" };
  }
  // Generic PascalCase (likely class/component)
  if (
    /^[A-Z][a-z]+(?:[A-Z][a-z]+)+$/.test(name) ||
    /^[A-Z][a-zA-Z0-9]+$/.test(name)
  ) {
    return { type: "Class", icon: "🏛️" };
  }
  // Async functions (xxxAsync or fetchXxx, loadXxx, getXxx, postXxx, etc.)
  if (
    /(?:Async|Promise)$/.test(name) ||
    /^(?:fetch|load|get|post|put|patch|delete|send|receive|request)[A-Z]/.test(
      name,
    )
  ) {
    return { type: "Async Fn", icon: "⚡" };
  }
  // Event handlers (onXxx, handleXxx)
  if (/^(?:on|handle)[A-Z]/.test(name)) {
    return { type: "Handler", icon: "👆" };
  }
  // Render functions (renderXxx)
  if (/^render[A-Z]/.test(name)) {
    return { type: "Renderer", icon: "🎨" };
  }
  // Validation functions (validateXxx, isXxx, hasXxx, canXxx, shouldXxx)
  if (/^(?:validate|is|has|can|should|check|verify)[A-Z]/.test(name)) {
    return { type: "Validator", icon: "✓" };
  }
  // Transform functions (formatXxx, parseXxx, convertXxx, toXxx, fromXxx)
  if (
    /^(?:format|parse|convert|transform|to|from|map|reduce|filter)[A-Z]/.test(
      name,
    )
  ) {
    return { type: "Transform", icon: "🔄" };
  }
  // Create/init functions (createXxx, initXxx, setupXxx, buildXxx)
  if (/^(?:create|init|setup|build|make|generate)[A-Z]/.test(name)) {
    return { type: "Factory", icon: "🏭" };
  }
  // Default: generic function (camelCase)
  if (/^[a-z][a-zA-Z0-9]*$/.test(name)) {
    return { type: "Function", icon: "ƒ" };
  }

  return { type: "Export", icon: "📦" };
}

// Simple force-directed push-apart algorithm
// Runs for a fixed number of iterations to separate overlapping nodes
function applyForceLayout(nodes, iterations = 8) {
  const NODE_WIDTH = 200;
  const NODE_HEIGHT = 80;
  const MIN_DISTANCE = 20; // Minimum gap between nodes
  const REPULSION = 0.5; // How much to push apart per iteration

  // Create mutable position copies
  const positions = nodes.map((n) => ({ ...n.position }));

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = positions[j].x - positions[i].x;
        const dy = positions[j].y - positions[i].y;

        // Calculate overlap
        const overlapX = NODE_WIDTH + MIN_DISTANCE - Math.abs(dx);
        const overlapY = NODE_HEIGHT + MIN_DISTANCE - Math.abs(dy);

        // If overlapping in both dimensions, push apart
        if (overlapX > 0 && overlapY > 0) {
          // Push in the direction of least overlap
          if (overlapX < overlapY) {
            const pushX = (overlapX / 2) * REPULSION * (dx >= 0 ? 1 : -1);
            positions[i].x -= pushX;
            positions[j].x += pushX;
          } else {
            const pushY = (overlapY / 2) * REPULSION * (dy >= 0 ? 1 : -1);
            positions[i].y -= pushY;
            positions[j].y += pushY;
          }
        }
      }
    }
  }

  // Apply new positions
  return nodes.map((node, i) => ({
    ...node,
    position: positions[i],
  }));
}

// Generate positions for vertical linked list layout with force-directed spacing
function generateLayout(steps, expandedNodes, auxiliaryNodes = {}) {
  const nodes = [];
  const edges = [];

  // Layout constants
  const BASE_MAIN_SPACING = 140; // Minimum spacing between main nodes
  const SUB_NODE_HEIGHT = 70; // Height per sub-node
  const AUX_NODE_HEIGHT = 65; // Height per auxiliary node
  const SUB_NODE_OFFSET_X = 300; // Sub-nodes to the right
  const AUX_NODE_OFFSET_X = -300; // Auxiliary nodes to the left

  // First pass: calculate space needed for each main node
  const nodeSpaces = steps.map((step) => {
    const mainNodeId = step.file;
    const isExpanded = expandedNodes.has(mainNodeId);
    const auxNodes = auxiliaryNodes[mainNodeId] || [];

    // Generate subNodes
    let subNodes = step.subNodes || [];
    if (subNodes.length === 0) {
      const exports = step.key_exports || [];
      const responsibilities = step.responsibilities || [];
      const dependencies = step.dependencies || [];

      exports.slice(0, 5).forEach((exp) => {
        const { type, icon } = inferExportType(exp);
        subNodes.push({ label: exp, type, icon });
      });

      dependencies.slice(0, 3).forEach((dep) => {
        if (!subNodes.find((s) => s.label === dep)) {
          subNodes.push({
            label: dep,
            type: "Dependency",
            icon: "🔗",
            isBacklink: true,
          });
        }
      });

      if (subNodes.length < 8 && responsibilities.length > 0) {
        responsibilities.slice(0, 2).forEach((resp) => {
          if (!subNodes.find((s) => s.label === resp)) {
            subNodes.push({ label: resp, type: "Responsibility", icon: "📋" });
          }
        });
      }
    }

    // Calculate vertical space needed
    const subNodeSpace = isExpanded
      ? Math.max(0, (subNodes.length - 1) * SUB_NODE_HEIGHT)
      : 0;
    const auxNodeSpace =
      auxNodes.length > 0
        ? Math.max(0, (auxNodes.length - 1) * AUX_NODE_HEIGHT)
        : 0;
    const totalSpace = BASE_MAIN_SPACING + Math.max(subNodeSpace, auxNodeSpace);

    return { step, subNodes, auxNodes, isExpanded, totalSpace };
  });

  // Second pass: position nodes using cumulative Y
  let currentY = 0;

  nodeSpaces.forEach(
    ({ step, subNodes, auxNodes, isExpanded, totalSpace }, index) => {
      const mainNodeId = step.file;
      const y = currentY;

      // Main node
      nodes.push({
        id: mainNodeId,
        type: "onboarding",
        position: { x: 0, y },
        data: {
          label: step.file,
          summary: step.summary,
          stepNumber: index + 1,
          isMainNode: true,
          isExpanded,
          hasChildren: subNodes.length > 0,
          responsibilities: step.responsibilities,
          key_exports: step.key_exports,
          dependencies: step.dependencies,
        },
      });

      // Edge to next main node
      if (index < steps.length - 1) {
        edges.push({
          id: `main-${index}`,
          source: mainNodeId,
          target: steps[index + 1].file,
          type: "smoothstep",
          animated: true,
          style: { stroke: "#06b6d4", strokeWidth: 2 },
        });
      }

      // Sub-nodes when expanded - fan out vertically centered on main node
      if (isExpanded && subNodes.length > 0) {
        const subNodeTotalHeight = (subNodes.length - 1) * SUB_NODE_HEIGHT;
        const subStartY = y - subNodeTotalHeight / 2;

        subNodes.forEach((subNode, subIndex) => {
          const subNodeId = `${mainNodeId}-sub-${subIndex}`;
          const subY = subStartY + subIndex * SUB_NODE_HEIGHT;

          nodes.push({
            id: subNodeId,
            type: "onboarding",
            position: { x: SUB_NODE_OFFSET_X, y: subY },
            data: {
              label: subNode.label,
              type: subNode.type,
              icon: subNode.icon,
              isSubNode: true,
              isMainNode: false,
              isBacklink: subNode.isBacklink,
              targetFile: subNode.targetFile,
            },
          });

          edges.push({
            id: `sub-${mainNodeId}-${subIndex}`,
            source: mainNodeId,
            sourceHandle: "right",
            target: subNodeId,
            targetHandle: "left",
            type: "smoothstep",
            style: {
              stroke: subNode.isBacklink ? "#f59e0b" : "#0891b2",
              strokeWidth: 1.5,
              strokeDasharray: subNode.isBacklink ? "3,3" : "5,5",
            },
          });
        });
      }

      // Auxiliary nodes - spread out vertically
      if (auxNodes.length > 0) {
        const auxNodeTotalHeight = (auxNodes.length - 1) * AUX_NODE_HEIGHT;
        const auxStartY = y - auxNodeTotalHeight / 2;

        auxNodes.forEach((auxNode, auxIndex) => {
          const auxNodeId = `${mainNodeId}-aux-${auxIndex}`;
          const auxY = auxStartY + auxIndex * AUX_NODE_HEIGHT;

          nodes.push({
            id: auxNodeId,
            type: "onboarding",
            position: { x: AUX_NODE_OFFSET_X, y: auxY },
            data: {
              label: auxNode.label,
              type: auxNode.type || "Insight",
              isSubNode: true,
              isMainNode: false,
              isAuxiliary: true,
              description: auxNode.description,
              targetFile: auxNode.targetFile,
            },
          });

          edges.push({
            id: `aux-${mainNodeId}-${auxIndex}`,
            source: auxNodeId,
            sourceHandle: "right",
            target: mainNodeId,
            targetHandle: "left",
            type: "smoothstep",
            animated: true,
            style: { stroke: "#a855f7", strokeWidth: 1.5 },
          });
        });
      }

      // Move to next Y position
      currentY += totalSpace;
    },
  );

  // Apply force-directed layout to push apart overlapping nodes
  const adjustedNodes = applyForceLayout(nodes);

  return { nodes: adjustedNodes, edges };
}

export default function OnboardingGraph({
  steps,
  onNodeClick,
  onNodeSelect,
  highlightedFiles,
  auxiliaryNodes,
}) {
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => generateLayout(steps || [], expandedNodes, auxiliaryNodes),
    [steps, expandedNodes, auxiliaryNodes],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when layout changes
  useMemo(() => {
    const { nodes: newNodes, edges: newEdges } = generateLayout(
      steps || [],
      expandedNodes,
      auxiliaryNodes,
    );
    setNodes(newNodes);
    setEdges(newEdges);
  }, [steps, expandedNodes, auxiliaryNodes, setNodes, setEdges]);

  // Apply highlighting
  useMemo(() => {
    if (!highlightedFiles) return;
    const highlighted = new Set(highlightedFiles);
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        style: {
          ...n.style,
          filter: highlighted.has(n.id) ? "brightness(1.3)" : undefined,
        },
      })),
    );
  }, [highlightedFiles, setNodes]);

  const handleNodeClick = useCallback(
    (_, node) => {
      if (node.data.isMainNode && node.data.hasChildren) {
        setExpandedNodes((prev) => {
          const next = new Set(prev);
          if (next.has(node.id)) {
            next.delete(node.id);
          } else {
            next.add(node.id);
          }
          return next;
        });
      }
      onNodeClick?.(node.id);

      // Pass full node data for Atlas exploration
      if (node.data.isMainNode) {
        const step = steps?.find((s) => s.file === node.id);
        if (step) {
          onNodeSelect?.({
            file: step.file,
            summary: step.summary,
            reason: step.reason,
            responsibilities: step.responsibilities,
            key_exports: step.key_exports,
            dependencies: step.dependencies,
          });
        }
      }
    },
    [onNodeClick, onNodeSelect, steps],
  );

  if (!steps || steps.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-500">
        <div className="text-center">
          <div className="text-4xl mb-4 opacity-50">🧭</div>
          <div>No onboarding path available</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative" style={{ background: "#09090b" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={1.5}
        // Multi-select: drag to create selection box
        selectionOnDrag
        // Pan with middle mouse button or when holding space
        panOnDrag={[1, 2]}
        // Allow selecting multiple nodes
        selectionMode="partial"
        // Move all selected nodes together when dragging
        selectNodesOnDrag
        // Allow multi-select with shift+click
        multiSelectionKeyCode="Shift"
        // Delete selected nodes with backspace/delete
        deleteKeyCode={["Backspace", "Delete"]}
      >
        <Background
          color="#1c1c1f"
          gap={30}
          size={1.5}
          style={{ backgroundColor: "#09090b" }}
        />
        <Controls
          className="!bg-[#09090b] !border !border-zinc-800 !rounded-lg !shadow-lg [&>button]:!bg-[#09090b] [&>button]:!border-zinc-800 [&>button]:!fill-zinc-500 [&>button:hover]:!fill-zinc-300"
          style={{}}
        />
      </ReactFlow>

      {/* Legend */}
      <div
        className="absolute top-4 left-4 bg-zinc-950/80 backdrop-blur-sm border border-zinc-800 rounded-lg px-3 py-2 text-[11px] text-zinc-500 pointer-events-none"
        style={{ zIndex: 10 }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-600 border border-cyan-300" />
            File
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-cyan-800 border border-cyan-500" />
            Export
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-amber-600 border border-amber-400" />
            Dependency
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-purple-600 border border-purple-400" />
            Atlas Insight
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-1.5 pt-1.5 border-t border-zinc-800">
          <span className="text-zinc-600">
            Drag to select • Shift+click multi-select • Middle-click to pan
          </span>
        </div>
      </div>
    </div>
  );
}
