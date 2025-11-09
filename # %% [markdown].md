
 # 🚖 TransVahan — Smart Campus Shuttle Management System
 
 **TransVahan** is a full-stack, real-time campus shuttle platform connecting **Users**, **Drivers**, and **Administrators**.  
 It provides live shuttle tracking, route editing, occupancy analytics, and predictive ETAs — built using Node.js, React, React Native, Firebase, AWS, and Terraform.
 
 ---
 
 ## 🧭 Project Overview
 
 | Module | Description |
 |--------|-------------|
 | **Backend** | Node.js + Express + Firebase + WebSocket for APIs & live updates |
 | **Admin Portal** | React + Vite dashboard for managing routes, vehicles, and drivers |
 | **User App** | React Native + Expo mobile app (EAS-built APK) |
 | **Infra** | Terraform + AWS (ECR, App Runner, S3 hosting) |
 
 ---
 
 ## ⚙️ 1. Prerequisites
 
 Install the following tools (latest stable versions recommended):
 
 | Tool | Purpose | Command |
 |------|----------|---------|
 | **Node.js** (≥ 20) | For backend & frontend builds | `sudo apt install nodejs npm` |
 | **Docker** | For backend containerization | [Install Guide](https://docs.docker.com/get-docker/) |
 | **AWS CLI v2** | To interact with AWS ECR/AppRunner/S3 | [AWS CLI Install](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) |
 | **Terraform (≥1.6)** | Infrastructure provisioning | `sudo apt install terraform` |
 | **Expo CLI + EAS CLI** | For React Native APK builds | `npm install -g expo-cli eas-cli` |
 | **Git** | Version control | `sudo apt install git` |
 
 ---
 
 ## 🌍 2. Repository Setup
 
 ```bash
 # Clone repo
 git clone -b <add_branch_name> --single-branch https://github.com/skmanoj2006/StormCrafters.git
 cd StormCrafters
 
 # 1) Backend env
 cp backend/.env.example backend/.env
 # edit backend/.env and fill real secrets
 
 # 2) Admin portal env
 cp admin-portal/.env.example admin-portal/.env
 # later, set VITE_API_BASE after backend URL is known
 
 # 3) Mobile app env
 cp transvahan-user/.env.example transvahan-user/.env
 # later, set API_BASE_URL + WS_URL after backend URL is known
 
 
 
 
 Replace each variable:
 
 
 cd backend
 
 # JWT Secret (generate one if you like)
 sed -i 's|your_jwt_secret_key|<paste_it_here>|g' .env
 
 # Gmail SMTP
 sed -i 's|ur_email|<paste_it_here>|g' .env
 sed -i 's|ur_app_password|<paste_it_here>|g' .env
 
 # Firebase
 sed -i 's|ur_project_id|<paste_it_here>|g' .env
 sed -i 's|ur_service_account_key_file.json|<paste_it_here>|g' .env
 
 # Google Maps
 sed -i 's|ur_google_maps_api_key|<paste_it_here>|g' .env
 
 
 
 You can quickly confirm your variables are set correctly:
 
 grep -v '^#' .env
 
 
 ```bash
 cd ..
 
 aws configure
 # Enter your AWS Access Key, Secret, Region (ap-south-1)
 
 
 aws ecr create-repository --repository-name <unique_repo_name>
 
 
 ```bash
 
 cd infra
 terraform init
 terraform plan
 terraform apply
 
 
 terraform output
 # Note admin_portal_website_endpoint
 
 
 
 
 ```bash
 # ===============================
 # 🐳 4️⃣ Build and Push Backend to AWS ECR
 # ===============================
 
 cd ../backend
 
 # 1️⃣ Authenticate Docker with AWS ECR
 aws ecr get-login-password --region ap-south-1 | \
   docker login --username AWS --password-stdin <aws_account_id>.dkr.ecr.ap-south-1.amazonaws.com
 
 # 2️⃣ Build the backend Docker image
 docker build -t transvahan-backend:latest .
 
 # 3️⃣ Tag the image for your ECR repository
 docker tag transvahan-backend:latest \
   <aws_account_id>.dkr.ecr.ap-south-1.amazonaws.com/<unique_repo_name>:latest
 
 # 4️⃣ Push the image to ECR
 docker push <aws_account_id>.dkr.ecr.ap-south-1.amazonaws.com/<unique_repo_name>:latest
 
 ```bash
 # ===============================
 # 🚀 5️⃣ Deploy Backend on AWS App Runner
 # ===============================
 # Go to AWS Console → App Runner
 # → Create service
 # → Choose "Container registry" → "Amazon ECR"
 # → Select your uploaded image (<unique_repo_name>)
 # → Port: 5001
 # → Deployment: Automatic (to redeploy on image push)
 # → Service name: transvahan-backend
 # → Allow public access
 
 # This will take time
 
 # Once deployed, note down the service URL (e.g. https://abcdefghi.ap-south-1.awsapprunner.com) this is ur <APP_RUNNER_BACKEND_URL> 
 # And make sure that what ever u have copied looks like this abcdefghi.ap-south-1.awsapprunner.com
 
 curl -i https://<APP_RUNNER_URL>/health
 
 #✅ Should return {"ok": true}
 ```bash
 cd ../transvahan-user
 
 # Replace the API Base URL (App Runner backend endpoint)
 sed -i 's|<APP_RUNNER_BACKEND_URL>|<paste_it_here>|g' .env
 
 # Replace the Google Maps API key
 sed -i 's|<YOUR_GOOGLE_MAPS_API_KEY>|<paste_it_here>|g' .env
 
 
 You can quickly confirm your variables are set correctly:
 
 grep -v '^#' .env
 
 # ===============================
 # 🧭 7️⃣ Build and Deploy Admin Portal (Frontend)
 # ===============================
 
 npm install
 npm run build
 
 # Upload to S3 bucket (from terraform output)
 aws s3 sync dist/ s3://stormcrafters-admin-portal-dev-1234 --delete
 
 ```bash
 cd ../admin-portal
 
 # Replace App Runner backend URL
 sed -i 's|<APP_RUNNER_BACKEND_URL>|<paste_it_here>|g' .env
 
 # Replace Google Maps API key
 sed -i 's|<YOUR_GOOGLE_MAPS_KEY>|<paste_it_here>|g' .env
 
 
 # Also make the same changes in eas.json you will need to change it in two places
 # "env": {
     #     "API_BASE_URL": "https://<APP_RUNNER_BACKEND_URL>",
     #     "WS_URL": "wss://<APP_RUNNER_BACKEND_URL>/ws",
     #     "USE_MOCK": "false",
     #     "GOOGLE_MAPS_API_KEY": "AIzaSyC5ya2Rnn2eZ9bilsmq1ArOj8ItnRq_c10"
     #   }
 
 # ===============================
 # 📱 8️⃣ Build Mobile App (APK)
 # ===============================
 
 npm install -g eas-cli
 eas login
 eas build --platform android --profile production
 
 #you will get an error  open the file app.config.ts in the folder transvahan-user
 # And follow the steps from line 50-55 precisely the below steps
 
 #            // after getting the error with missing env variables in EAS Build,
 #                // paste the eas project here
 #                // it should look like this:
 #                // eas: {
 #                //   projectId: "your-eas-project-id",
 #                // },
 
 # APK will appear in your Expo dashboard
 
 
 
 