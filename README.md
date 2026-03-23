# Booking App

✨ Built with Next.js.

## 🚀 Getting Started

Follow these simple steps to get the application running in your local environment.

### 📋 Prerequisites

Before you begin, ensure you have the following installed:
- 📦 Node.js (version 18 or later)
- 🔧 npm (usually comes with Node.js)
- 💻 Your favorite code editor
- ⚡ Git for version control

### 🛠️ Installation

1. Clone the repository or download the project files:
```bash
git clone https://github.com/ITPNYU/booking-app.git
```

2. Navigate to the project directory:
```bash
cd booking-app/booking-app
```

3. Install the dependencies:
```bash
npm install
```

4. 🔐 Obtain the `.env.local` file from a project administrator (Riho or Nima) and place it in the root directory of the project.

### Running the Application

To start the development server:
```bash
npm run dev
```

🌐 The application should now be running at [http://localhost:3000](http://localhost:3000)

### 🔍 Verifying Installation

Once the application is running, you should be able to:
- View the homepage at http://localhost:3000
- Access the admin dashboard (if you are authorized)
- See the booking interface

## 🔒 Environment Variables

This project relies on environment variables for secure configuration. Important notes:
- Request the `.env.local` file from project admin or another dev
- Never commit the `.env` file to version control
- Keep the environment variables secure and confidential


## 🧪 Testing the Application

This application includes a testing suite to ensure any potential bugs are caught before deployment. Here's how to run the tests and what tools to use.

#### Testing Tools
- **[Vitest](https://vitest.dev/):** A unit testing framework for testing individual components and utilities.
- **[Playwright](https://playwright.dev/):** A tool for end-to-end (E2E) testing, ensuring that the entire user experience works as expected.

#### Available Test Scripts
In the `package.json` file, the following test scripts are defined:

- **Unit Tests:** Run tests for individual units or components of the app.
  ```bash
  npm run test:unit
  ```
  Uses **Vitest** for fast and efficient unit testing.

- **End-to-End Tests:** Run comprehensive tests simulating user interactions.
  ```bash
  npm run test:e2e
  ```
  Uses **Playwright** to verify that the application functions as expected from a user's perspective.

- **All Tests:** Run both unit and end-to-end tests sequentially.
  ```bash
  npm run test:all
  ```

#### Running Tests
1. Ensure the application is installed and up to date:
   ```bash
   npm install
   ```

2. Make sure the environemnt variables below are set accordingly: 
   ```bash
   NEXT_PUBLIC_BRANCH_NAME=development
   CI=true
   TEST_EMAIL_ADDRESS=<YOUR_TEST_EMAIL_ADDRESS>
   TEST_PASSWORD=<YOUR_TEST_EMAIL_PASSWORD>
   ```
2. Run the desired test script:
   - For unit tests: `npm run test:unit`
   - For E2E tests: `npm run test:e2e`
   - For all tests: `npm run test:all`

3. View the results in the console. Fix any failing tests before proceeding with development or deployment.

#### Notes
- **Environment:** Ensure you have the **development** `.env.local` file properly configured for your testing environment.
- **Playwright Setup:** If running Playwright tests for the first time, install the required browsers:
  ```bash
  npx playwright install
  ```

## 🚢 Deployment

This project uses a CI/CD pipeline with automated deployments:

| Branch | Environment | Description |
|--------|-------------|-------------|
| `main` | 🔧 Development | Automatic deployment for testing new features |
| `staging` | 🔬 Staging | Pre-production testing and QA |
| `prod` | 🚀 Production | Live production environment |

### 📝 Deployment Guidelines

1. Always create feature branches from `main`
2. Test thoroughly in development
3. Create pull requests for code review
4. Merge to appropriate branch based on deployment target

## Staging Environment Control

The staging environment can be manually started and stopped via GitHub Actions to save costs when not in use.

### Stopping Staging

1. Go to **Actions** > **Staging Start/Stop** in the GitHub repository
2. Click **Run workflow**
3. Select **stop** from the dropdown
4. Click **Run workflow**

### Starting Staging

1. Go to **Actions** > **Staging Start/Stop** in the GitHub repository
2. Click **Run workflow**
3. Select **start** from the dropdown
4. Click **Run workflow**
5. The workflow will automatically verify that staging is accessible before completing

> Cron jobs (auto-checkout, auto-cancel-declined) will continue to run on schedule even when staging is stopped. They will log a warning instead of failing when the staging server is unreachable.

## 🔄 Regular Maintenance

Remember to keep your local environment up to date:
```bash
git pull
npm install
```
