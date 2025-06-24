import {
  Box,
  Chip,
  CircularProgress,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

interface WebCheckoutItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  status: string;
  serialNumber?: string;
  resourceType?: string;
  checkoutDate?: string;
  dueDate?: string;
  condition?: string;
}

interface CustomerInfo {
  name?: string;
  email?: string;
  netId?: string;
}

interface WebCheckoutCartData {
  cartNumber: string;
  allocationId?: string;
  customer?: CustomerInfo;
  items: WebCheckoutItem[];
  totalItems: number;
  checkoutDate?: string;
  dueDate?: string;
  status?: string;
  notes?: string;
}

interface Props {
  cartNumber: string | undefined;
  maxDisplayItems?: number;
}

export default function WebCheckoutEquipmentDisplay({
  cartNumber,
  maxDisplayItems = 3,
}: Props) {
  const [cartData, setCartData] = useState<WebCheckoutCartData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cartNumber) {
      setCartData(null);
      return;
    }

    const fetchCartData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/webcheckout/cart/${cartNumber}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError("Cart not found");
          } else {
            setError("Failed to fetch cart data");
          }
          return;
        }

        const data = await response.json();
        setCartData(data);
      } catch (err) {
        console.error("Error fetching cart data:", err);
        setError("Failed to fetch cart data");
      } finally {
        setLoading(false);
      }
    };

    fetchCartData();
  }, [cartNumber]);

  if (!cartNumber) {
    return (
      <Typography variant="body2" color="text.secondary">
        -
      </Typography>
    );
  }

  if (loading) {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Loading...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Tooltip title={error}>
        <Typography variant="body2" color="error">
          Error
        </Typography>
      </Tooltip>
    );
  }

  if (!cartData || cartData.items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No items
      </Typography>
    );
  }

  const displayItems = cartData.items.slice(0, maxDisplayItems);
  const remainingItems = cartData.items.length - displayItems.length;

  const formatEquipmentName = (item: WebCheckoutItem) => {
    let displayName = item.name;
    if (item.quantity > 1) {
      displayName = `${item.name} (${item.quantity})`;
    }
    return displayName;
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "available":
        return "success";
      case "checked_out":
      case "out":
        return "warning";
      case "maintenance":
        return "error";
      case "returned":
        return "info";
      default:
        return "default";
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return undefined;
    try {
      return new Date(dateString).toLocaleDateString("ja-JP");
    } catch {
      return dateString;
    }
  };

  return (
    <Box display="flex" flexDirection="column" gap={0.5}>
      {displayItems.map((item) => (
        <Tooltip
          key={item.id}
          title={
            <Box>
              <Typography variant="body2">
                <strong>{item.name}</strong>
              </Typography>
              {item.description && (
                <Typography variant="caption" display="block">
                  {item.description}
                </Typography>
              )}
              {item.serialNumber && (
                <Typography variant="caption" display="block">
                  SN: {item.serialNumber}
                </Typography>
              )}
              {item.resourceType && (
                <Typography variant="caption" display="block">
                  Type: {item.resourceType}
                </Typography>
              )}
              <Typography variant="caption" display="block">
                Status: {item.status}
              </Typography>
              {item.dueDate && (
                <Typography variant="caption" display="block">
                  Due: {formatDate(item.dueDate)}
                </Typography>
              )}
            </Box>
          }
        >
          <Chip
            label={formatEquipmentName(item)}
            size="small"
            color={getStatusColor(item.status)}
            variant="outlined"
            sx={{
              fontSize: "0.75rem",
              height: "24px",
              maxWidth: "150px",
              "& .MuiChip-label": {
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              },
            }}
          />
        </Tooltip>
      ))}

      {remainingItems > 0 && (
        <Tooltip title={`${remainingItems} more items in cart ${cartNumber}`}>
          <Chip
            label={`+${remainingItems} more`}
            size="small"
            variant="outlined"
            color="default"
            sx={{
              fontSize: "0.75rem",
              height: "24px",
              fontStyle: "italic",
            }}
          />
        </Tooltip>
      )}

      {cartData.customer && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          {cartData.customer.name && `${cartData.customer.name} • `}
          Cart: {cartNumber} ({cartData.totalItems} items)
        </Typography>
      )}

      {!cartData.customer && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          Cart: {cartNumber} ({cartData.totalItems} items)
        </Typography>
      )}
    </Box>
  );
}
