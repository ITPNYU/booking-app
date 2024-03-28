import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import NavDropdown from 'react-bootstrap/NavDropdown';
import { NavLink } from 'react-router-dom';
import Navbar from 'react-bootstrap/Navbar';
import React from 'react';

export default function NavBar() {
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
                to="/admin"
              >
                Admin
              </NavLink>
            </Nav.Item>
            <Nav.Item>
              <NavLink className="nav-link" activeClassName="active" to="/pa">
                PA
              </NavLink>
            </Nav.Item>
            <NavDropdown title="Resources" id="basic-nav-dropdown" align="end">
              <NavDropdown.Item href="https://docs.google.com/presentation/d/1SwMhL65dR6x2BMqlcQ4GbyD1w2ydfrd3MG5XCJrsmAA/edit?authuser=0#slide=id.p">
                Spaces Index
              </NavDropdown.Item>
              <NavDropdown.Item href="https://docs.google.com/spreadsheets/d/1fziyVrzeytQJyZ8585Wtqxer-PBt6L-u-Z0LHVavK5k/edit?usp=sharing&authuser=0">
                Garage Equipment
              </NavDropdown.Item>
              <NavDropdown.Item href="https://drive.google.com/a/nyu.edu/open?id=10D5aFildkZHi1fyVrXcPXPsvXGZDBTGPitputVkjZsk&authuser=0">
                Stakeholder Matrix
              </NavDropdown.Item>
            </NavDropdown>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}
