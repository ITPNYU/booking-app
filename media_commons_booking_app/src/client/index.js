import { RouterProvider, createMemoryRouter } from 'react-router-dom';

import AdminPage from './routes/admin/adminPage';
import BookingForm from './routes/booking/BookingForm';
import ErrorPage from './errorPage';
import LandingPage from './routes/booking/formPages/LandingPage';
import PAPage from './routes/pa/PAPage';
import React from 'react';
import Root from './routes/root';
import SelectRoomPage from './routes/booking/formPages/SelectRoomPage';
import UserRolePage from './routes/booking/formPages/UserRolePage';
import UserSectionPage from './routes/booking/formPages/UserSectionPage';
import { createRoot } from 'react-dom/client';

const router = createMemoryRouter([
  {
    path: '/',
    element: <Root />,
    errorElement: <ErrorPage />,
    children: [
      {
        path: '/admin',
        element: <AdminPage />,
      },
      {
        path: '/pa',
        element: <PAPage />,
      },
      {
        path: '/',
        element: <BookingForm />,
        children: [
          {
            path: '/book/role',
            element: <UserRolePage />,
          },
          {
            path: '/book/selectRoom',
            element: <SelectRoomPage />,
          },
          {
            path: '/book/form',
            element: <UserSectionPage />,
          },
          {
            path: '/',
            element: <LandingPage />,
          },
        ],
      },
    ],
  },
]);

const container = document.getElementById('index');
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
