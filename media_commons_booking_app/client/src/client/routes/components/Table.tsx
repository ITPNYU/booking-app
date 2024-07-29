import {
  Box,
  Table as MuiTable,
  SxProps,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Theme,
} from '@mui/material';

import React from 'react';
import { styled } from '@mui/system';

const TableCustom = styled(MuiTable)(({ theme }) => ({
  border: `1px solid ${theme.palette.custom.border}`,
  borderCollapse: 'separate',
  borderRadius: '0px 0px 4px 4px',

  '& tr:last-child td': {
    borderBottom: 'none',
  },
}));

const ShadedHeader = styled(TableHead)(({ theme }) => ({
  backgroundColor: theme.palette.custom.gray,
}));

export const TableTopRow = styled(MuiTable)`
  height: 48px;
  border-bottom: none;
  border-collapse: separate;
  border-radius: 4px 4px 0px 0px;
  padding: 0;

  th,
  td {
    border: none;
    padding: 0;
  }
`;

export const TableEmpty = styled(Box)`
  color: rgba(0, 0, 0, 0.38);
  display: flex;
  justify-content: center;
  align-items: center;
  height: 25vh;
`;

interface Props {
  columns: React.ReactNode[];
  children: React.ReactNode[];
  topRow: React.ReactNode;
  sx?: SxProps<Theme>;
}

export default function Table({ columns, children, topRow, sx }: Props) {
  return (
    <>
      <TableTopRow>
        <TableBody>
          <TableRow>
            <TableCell>{topRow}</TableCell>
          </TableRow>
        </TableBody>
      </TableTopRow>
      <TableCustom size="small" sx={sx ?? {}}>
        <ShadedHeader>
          <TableRow>{columns}</TableRow>
        </ShadedHeader>
        <TableBody>{children}</TableBody>
      </TableCustom>
    </>
  );
}
