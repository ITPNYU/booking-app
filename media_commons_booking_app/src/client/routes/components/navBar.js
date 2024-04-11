import React, { useContext } from 'react';

import Container from 'react-bootstrap/Container';
import { DatabaseContext } from './Provider';
import Nav from 'react-bootstrap/Nav';
import { NavLink } from 'react-router-dom';
import Navbar from 'react-bootstrap/Navbar';
import { PagePermission } from '../../../types';

export default function NavBar() {
  const { pagePermission } = useContext(DatabaseContext);

  return (
    <Navbar expand="md" className="bg-body-tertiary z-10">
      <Container fluid>
        <Navbar.Brand>
          <NavLink to="/"> Media Commons Booking</NavLink>
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto">
            <Nav.Item>
              <NavLink
                className="nav-link"
                activeClassName="active"
                to="/my-bookings"
              >
                My Bookings
              </NavLink>
            </Nav.Item>
            {pagePermission === PagePermission.ADMIN && (
              <Nav.Item>
                <NavLink
                  className="nav-link"
                  activeClassName="active"
                  to="/admin"
                >
                  Admin
                </NavLink>
              </Nav.Item>
            )}
            {(pagePermission === PagePermission.ADMIN ||
              pagePermission === PagePermission.PA) && (
              <Nav.Item>
                <NavLink className="nav-link" activeClassName="active" to="/pa">
                  PA
                </NavLink>
              </Nav.Item>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}
