"use client";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useState } from "react";

type IdentityResult = Record<string, unknown>;

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function IdentityTable({ data }: { data: IdentityResult }) {
  const entries = Object.entries(data);
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ mt: 3 }}>
      <Table size="small">
        <TableBody>
          {entries.map(([key, value]) => (
            <TableRow key={key} hover>
              <TableCell
                sx={{
                  fontWeight: 600,
                  width: "35%",
                  color: "text.secondary",
                  fontFamily: "monospace",
                  fontSize: "0.8rem",
                  verticalAlign: "top",
                }}
              >
                {key}
              </TableCell>
              <TableCell
                sx={{
                  fontFamily:
                    typeof value === "object" ? "monospace" : "inherit",
                  fontSize: "0.85rem",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {formatValue(value)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function NyuIdentityLookup() {
  const [netId, setNetId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IdentityResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queriedNetId, setQueriedNetId] = useState<string | null>(null);

  const handleLookup = async () => {
    const trimmed = netId.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setQueriedNetId(trimmed);

    try {
      const response = await fetch(`/api/nyu/identity/${encodeURIComponent(trimmed)}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data?.error ?? `Request failed with status ${response.status}`);
      } else if (!data) {
        setError("No identity record found for this NetID.");
      } else {
        setResult(data);
      }
    } catch {
      setError("Network error — could not reach the identity API.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLookup();
  };

  return (
    <Box sx={{ maxWidth: 800, mt: 4 }}>
      <Typography variant="h6" gutterBottom>
        NYU Identity Lookup
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enter a NetID to retrieve the raw identity record from the NYU Identity
        API.
      </Typography>
      <Divider sx={{ mb: 3 }} />

      <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
        <TextField
          label="NetID"
          value={netId}
          onChange={(e) => setNetId(e.target.value)}
          onKeyDown={handleKeyDown}
          size="small"
          sx={{ width: 260 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          placeholder="e.g. abc123"
          autoComplete="off"
        />
        <Button
          variant="contained"
          onClick={handleLookup}
          disabled={loading || !netId.trim()}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {loading ? "Looking up…" : "Look Up"}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mt: 3 }}>
          {error}
        </Alert>
      )}

      {result && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Results for{" "}
            <Box component="span" sx={{ fontFamily: "monospace", fontWeight: 600 }}>
              {queriedNetId}
            </Box>
          </Typography>
          <IdentityTable data={result} />
        </Box>
      )}
    </Box>
  );
}
