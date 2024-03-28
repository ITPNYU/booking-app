import '../styles.css';

import { DatabaseProvider } from './components/Provider';
import NavBar from './components/navBar';
import { Outlet } from 'react-router-dom';
import React from 'react';

export default function Root() {
  return (
    <DatabaseProvider>
      <NavBar />

      {/* This is where child route content renders, i.e. the subpages */}
      <Outlet />
    </DatabaseProvider>
  );
}
