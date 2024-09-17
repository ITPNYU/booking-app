import { CircularProgress } from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import React from 'react';

interface Props {
  style?: any;
}

export default function Loading({ style }: Props) {
  return <CircularProgress color="primary" style={style} />;
}

export function CenterLoading({ style }: Props) {
  return (
    <Grid
      container
      height="55vh"
      justifyContent="center"
      alignItems="center"
      style={style}
    >
      <Loading />
    </Grid>
  );
}
