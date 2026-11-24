"use client";

import { Alert, Box, Breadcrumbs, Chip, Link, Typography } from "@mui/material";
import { useState } from "react";
import {
  layoutApprovalFlow,
  type ApprovalDiagramNode,
} from "./approvalFlowDiagram";

function nodeColors(node: ApprovalDiagramNode): {
  fill: string;
  stroke: string;
  dash?: string;
} {
  if (node.kind === "external") {
    return { fill: "#fafafa", stroke: "#90a4ae", dash: "4 3" };
  }
  if (node.kind === "final") return { fill: "#eceff1", stroke: "#455a64" };
  if (node.kind === "parallel") return { fill: "#f3e5f5", stroke: "#8e24aa" };
  if (node.kind === "compound") return { fill: "#e3f2fd", stroke: "#1565c0" };
  if (node.initial) return { fill: "#e8f5e9", stroke: "#2e7d32" };
  return { fill: "#ffffff", stroke: "#607d8b" };
}

function edgeColor(kind: "event" | "always" | "after" | "done"): string {
  if (kind === "done") return "#6a1b9a";
  if (kind === "always" || kind === "after") return "#ef6c00";
  return "#546e7a";
}

export default function ApprovalFlowDiagram({
  value,
  invalidText = false,
}: {
  value: unknown;
  /** The JSON textarea holds text that does not parse. */
  invalidText?: boolean;
}) {
  const [path, setPath] = useState<string[]>([]);
  const [source, setSource] = useState(value);
  if (value !== source) {
    setSource(value);
    if (path.length > 0) setPath([]);
  }
  const activePath = value === source ? path : [];
  const attempted = layoutApprovalFlow(value, activePath);
  if (!attempted.ok && activePath.length > 0) setPath([]);
  const diagram = attempted.ok ? attempted : layoutApprovalFlow(value, []);
  const shownPath = attempted.ok ? activePath : [];

  if ("message" in diagram) {
    return <Alert severity="warning">{diagram.message}</Alert>;
  }

  const title = diagram.machineId ?? "Approval flow";
  const crumbs = [title, ...shownPath];

  return (
    <Box aria-label={`${title} diagram`}>
      {invalidText && (
        <Alert severity="warning" sx={{ mb: 1 }}>
          The editor text is not valid JSON. This diagram is the last value that
          parsed.
        </Alert>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Read-only. Switch to JSON to change the flow.
      </Typography>
      {shownPath.length > 0 && (
        <Breadcrumbs sx={{ mb: 1, fontSize: 14 }}>
          {crumbs.map((crumb, index) =>
            index < crumbs.length - 1 ? (
              <Link
                key={crumb}
                component="button"
                type="button"
                underline="hover"
                onClick={() => setPath(shownPath.slice(0, index))}
              >
                {crumb}
              </Link>
            ) : (
              <Typography key={crumb} variant="body2" color="text.primary">
                {crumb}
              </Typography>
            ),
          )}
        </Breadcrumbs>
      )}
      {shownPath.length === 0 && (
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {title}
        </Typography>
      )}
      {diagram.exits.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
          {diagram.exits.map((exit) => (
            <Chip
              key={`${exit.label}->${exit.to}`}
              size="small"
              variant="outlined"
              label={`${exit.label} → ${exit.to}`}
            />
          ))}
        </Box>
      )}
      <Box
        sx={{
          overflow: "auto",
          border: "1px solid #ddd",
          borderRadius: 1,
          bgcolor: "#fafafa",
          maxHeight: "calc(100vh - 240px)",
        }}
      >
        <svg width={diagram.width} height={diagram.height} role="presentation">
          <defs>
            <marker
              id="approval-flow-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M0,0 L8,4 L0,8 Z" fill="#546e7a" />
            </marker>
          </defs>
          {diagram.edges.map((edge) => (
            <g key={edge.id}>
              <path
                d={edge.path}
                fill="none"
                stroke={edgeColor(edge.kind)}
                strokeWidth={1.4}
                strokeDasharray={
                  edge.kind === "always" || edge.kind === "after"
                    ? "5 3"
                    : undefined
                }
                markerEnd="url(#approval-flow-arrow)"
              />
              <text
                x={edge.labelX}
                y={edge.labelY}
                textAnchor={edge.labelAnchor}
                fontSize={11}
                fill={edgeColor(edge.kind)}
                stroke="#fafafa"
                strokeWidth={3}
                paintOrder="stroke"
              >
                {edge.label}
                <title>{edge.label}</title>
              </text>
            </g>
          ))}
          {diagram.nodes.map((node) => {
            const colors = nodeColors(node);
            const lines = [
              node.name,
              node.kind === "parallel"
                ? "parallel"
                : node.kind === "final"
                  ? "final"
                  : node.kind === "compound"
                    ? "nested"
                    : node.kind === "external"
                      ? "outside this view"
                      : "",
              node.loops.join(" / "),
            ].filter(Boolean);
            return (
              <g
                key={node.id}
                role={node.clickable ? "button" : undefined}
                aria-label={node.clickable ? `Open ${node.name}` : undefined}
                tabIndex={node.clickable ? 0 : undefined}
                style={{ cursor: node.clickable ? "pointer" : "default" }}
                onClick={() => {
                  if (node.clickable)
                    setPath((current) => [...current, node.name]);
                }}
                onKeyDown={(event) => {
                  if (!node.clickable) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setPath((current) => [...current, node.name]);
                  }
                }}
              >
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.height}
                  rx={8}
                  fill={colors.fill}
                  stroke={colors.stroke}
                  strokeWidth={node.initial ? 2 : 1.2}
                  strokeDasharray={colors.dash}
                />
                {lines.map((line, index) => (
                  <text
                    key={line}
                    x={node.x + node.width / 2}
                    y={node.y + 20 + index * 16}
                    textAnchor="middle"
                    fontSize={index === 0 ? 13 : 11}
                    fontWeight={index === 0 ? 600 : 400}
                    fill={index === 0 ? "#263238" : "#607d8b"}
                  >
                    {line}
                  </text>
                ))}
              </g>
            );
          })}
        </svg>
      </Box>
    </Box>
  );
}
