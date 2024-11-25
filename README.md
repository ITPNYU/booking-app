# Booking App

This project is a booking management application built with Next.js.

## Getting Started

Follow these steps to run the application in your local environment.

### Prerequisites

- Node.js (version 18 or later)
- npm (usually comes with Node.js)

### Installation

1. Clone the repository or download the project files.

2. Navigate to the project directory:
   ```
   cd booking-app
   ```
3. Install the dependencies:
   `npm install`
4. Obtain the `.env` file from a project administrator and place it in the root directory of the project.

### Running the Application

To start the development server:
`npm run dev`
The application should now be running on [http://localhost:3000](http://localhost:3000).

## Environment Variables

This project uses environment variables for configuration. Make sure you have received the `.env` file from a project administrator and placed it in the root directory before running the application.

## Deployment

This project uses automated deployment pipelines:

- Pushing to the `main` branch automatically deploys to the development environment.
- Pushing to the `staging` branch automatically deploys to the staging environment.
- Pushing to the `production` branch automatically deploys to the production environment.

Please ensure you push your changes to the appropriate branch based on the intended deployment environment.
