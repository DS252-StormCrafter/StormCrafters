# Transvahan Cloud Shuttle System

A cloud-based platform for IISc shuttle tracking and management. This project includes a React Native mobile app for users, a React admin portal, and a Node.js backend deployed on AWS.

## 🚍 Features
- Live shuttle tracking (GPS updates every 2s).
- Route maps, stops, and 20-min schedule display.
- Real-time seat availability (max 4 seats/vehicle).
- Admin dashboard for monitoring & notifications.
- Cross-platform: Android, iOS, Web.

## 📂 Repository Structure

This project is a monorepo containing several distinct services:

-   `/admin-portal`: A React + Vite frontend for administrators, deployed to S3 and served by CloudFront.
-   `/backend`: A Node.js + Express API, containerized with Docker and deployed to AWS App Runner.
-   `/transvahan-user`: The React Native (Expo) mobile application for end-users.
-   `/eta-service`: A Python microservice for ETA calculations.
-   `/infra`: Contains all Terraform code for provisioning the AWS infrastructure.
-   `/db`: Holds database schemas and seed scripts.
-   `/.github/workflows`: Defines the Continuous Integration (CI) pipeline using GitHub Actions.

---

## 🚀 Production Deployment Pipeline

This guide details the commands required to deploy the entire production-ready application, from infrastructure provisioning to application deployment.

### Prerequisites

Ensure you have the following CLI tools installed and configured:
1.  **AWS CLI**: Configured with credentials (`aws configure`).
2.  **Terraform**: For infrastructure provisioning.
3.  **Docker**: For building the backend container.
4.  **Node.js (v20)** & **npm**: For building the admin portal and running scripts.
5.  **Firebase CLI**: For database seeding (`npm install -g firebase-tools`).
6.  **EAS CLI**: For building the mobile app (`npm install -g eas-cli`).

### Step 1: Provision AWS Infrastructure (Terraform)

This step provisions the ECR repository, App Runner service, S3 bucket, and CloudFront distribution.

1.  Navigate to the infrastructure directory:
    ```bash
    cd infra
    ```
2.  Create a `terraform.tfvars` file to provide the required variables (e.g., secrets, AWS profile). The required variables are defined in `infra/main.tf` and include `jwt_secret`, `email_user`, `email_pass`, etc..

    **Example `terraform.tfvars`:**
    ```hcl
    aws_region        = "us-east-1"
    aws_profile       = "default"
    environment       = "production"
    jwt_secret        = "YOUR_SUPER_SECRET_JWT_KEY"
    email_user        = "your-email@gmail.com"
    email_pass        = "your-email-password"
    firebase_project_id = "your-firebase-project-id"
    google_maps_api_key = "YOUR_GOOGLE_MAPS_API_KEY"
    admin_portal_origin = "[https://your-cloudfront-domain.com](https://your-cloudfront-domain.com)"
    mobile_app_origin = "*" 
    ```

3.  Initialize and apply the Terraform configuration:
    ```bash
    terraform init
    terraform plan
    terraform apply -auto-approve
    ```
    
    Take note of the Terraform outputs, especially the `admin_portal_url`.

### Step 2: Build & Deploy the Backend (AWS App Runner)

The App Runner service is configured to automatically redeploy whenever a new image is pushed to the ECR repository with the `latest` tag.

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```

2.  Build the Docker image. The image is based on `node:20-alpine` and copies the production dependencies and source code.
    ```bash
    docker build -t stormcrafters-backend .
    ```

3.  Log in to the AWS ECR repository. (Replace `<aws_account_id>` and `<region>` with your details).
    ```bash
    aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <aws_account_id>.dkr.ecr.<region>.amazonaws.com
    ```

4.  Tag the local image with the ECR repository URI. The repository name is `stormcrafters-backend`.
    ```bash
    docker tag stormcrafters-backend:latest <aws_account_id>.dkr.ecr.<region>[.amazonaws.com/stormcrafters-backend:latest](https://.amazonaws.com/stormcrafters-backend:latest)
    ```

5.  Push the image to ECR. This will automatically trigger the App Runner deployment.
    ```bash
    docker push <aws_account_id>.dkr.ecr.<region>[.amazonaws.com/stormcrafters-backend:latest](https://.amazonaws.com/stormcrafters-backend:latest)
    ```

### Step 3: Build & Deploy the Admin Portal (S3 & CloudFront)

This process builds the static React app and syncs it to the S3 bucket created by Terraform.

1.  Navigate to the admin portal directory:
    ```bash
    cd admin-portal
    ```

2.  Install dependencies:
    ```bash
    npm ci
    ```

3.  Build the production application. This uses Vite to create a static build in the `dist/` directory.
    ```bash
    npm run build
    ```

4.  Sync the build output to the S3 bucket. The bucket name is `stormcrafters-admin-portal`.
    ```bash
    aws s3 sync ./dist s3://stormcrafters-admin-portal --delete
    ```

5.  (Recommended) Invalidate the CloudFront cache to ensure users see the latest version. Get the `Distribution ID` from the AWS console or Terraform output.
    ```bash
    aws cloudfront create-invalidation --distribution-id <YOUR_DISTRIBUTION_ID> --paths "/*"
    ```

### Step 4: Build & Deploy the Mobile App (Expo EAS)

The mobile app is built using Expo Application Services (EAS).

1.  Navigate to the user app directory:
    ```bash
    cd transvahan-user
    ```
2.  Log in to your Expo account:
    ```bash
    eas login
    ```
3.  Configure the project for EAS Build (if not already done):
    ```bash
    eas build:configure
    ```
4.  Run the build for the desired platforms (e.g., Android, iOS, or all):
    ```bash
    eas build --platform all
    ```
    This will build the app bundles in the cloud, which you can then submit to the respective app stores.

### Step 5: Seed the Database (Firebase)

The root `package.json` contains scripts for seeding the Firestore and Realtime Database.

1.  Navigate to the root directory of the repository:
    ```bash
    cd .. 
    ```

2.  Install the root-level dependencies:
    ```bash
    npm install
    ```

3.  Log in to Firebase:
    ```bash
    firebase login
    ```

4.  Run the seed scripts. Ensure your Firebase service account key is correctly referenced in the scripts.
    ```bash
    npm run seed:firestore
    npm run seed:rtdb
    ```

---

## 💻 Local Development

Use the following commands to run the services locally.

### Backend

1.  Navigate to `/backend`.
2.  Create a `.env` file with the necessary environment variables (see `infra/main.tf` for the full list).
3.  Install dependencies: `npm install`
4.  Run the development server:
    ```bash
    npm run dev
    ```
    The server will start on port 5001.

### Admin Portal

1.  Navigate to `/admin-portal`.
2.  Install dependencies: `npm install`
3.  Run the Vite development server:
    ```bash
    npm run dev
    ```

### Mobile App (Expo)

1.  Navigate to `/transvahan-user`.
2.  Install dependencies: `npm install`
3.  Start the Expo development server:
    ```bash
    npm start
    ```
    This will open the Expo developer tools, allowing you to run the app in a simulator or on your phone using the Expo Go app.

### Firebase Emulators

The project is configured to use Firebase emulators for local development (Auth, Firestore, RTDB).

1.  From the root directory, start the emulators:
    ```bash
    firebase emulators:start
    ```
    You can access the Emulator UI at `http://localhost:4000`.

## ⚙️ Continuous Integration (CI)

This project uses GitHub Actions for CI, defined in `.github/workflows/ci.yml`.

-   **Triggers**: The pipeline runs on `push` and `pull_request` events to the `postmid1` and `dev` branches.
-   **Jobs**: It runs separate jobs to install dependencies, run tests, and perform production builds for all major services (`admin-portal`, `transvahan-user`, `cloud-chat`, `backend`, `eta-service`, `transvahan-eta`).
-   **Note**: This CI pipeline *does not deploy* to production. Deployment is a manual process following the steps outlined above.