# Booking App

## About

This application is designed for reserving rooms at the 370J Media Commons Room.

## Deployment

We employ GitHub workflows for our deployment process.
Any merges into the main branch automatically trigger a deployment to the production Google App Script.
We employ GitHub workflows for our deployment process. Pushing or merging to different branches will automatically trigger different Google App Script deploys:
- `main` branch: triggers the DEVELOPMENT deploy, which serves from localhost and reads/writes the development calendars
- `staging` branch: triggers the STAGING deploy, which serves from the GAS project and reads/writes the development calendars
- `prod` branch: triggers the PRODUCTION deploy, which serves from the GAS project and reads/writes the **production** calendars
The `NODE_ENV` environment variable controls where we serve from, and the `CALENDAR_ENV` environment variable controls which calendars we use. These values are specified in the `package.json` commands triggered by the workflows

## Setup Instructions

When developing locally, please follow the flow below.

1. **Clone the Repository**:

2. **Install Packages**:
   ```bash
   npm install
   ```

3. **Make sure that you have placed the `.env.local` file in the root directory**

4. **Run the dev local server**
   ```bash
   npm run dev
   ```