
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
 git clone https://github.com/skmanoj2006/StormCrafters.git
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
 
 ```
 
 
 ## ⚡ 3. Backend Environment Setup
 Generate a JWT_SECRET_KEY
 ```bash
 head -c 32 /dev/urandom | base64
```

 - Create a Firebase Project in the Firebase Console 
 - Go to Project Settings -> Service Accounts -> Generate new private key (Node.js) 
 - Save the downloaded file in ```./backend```

  In the ```./backend``` run the following commands
 
 ```bash
 
 
 # JWT Secret (generate one in the previous step)
 sed -i 's|<JWT_SECRET_KEY>|<paste_it_here>|g' .env
 
 # Gmail SMTP (For OTP services enter a valid e-mail and passkey) 
 sed -i 's|<EMAIL_ID>|<paste_it_here>|g' .env
 sed -i 's|<EMAIL_PASSWORD>|<paste_it_here>|g' .env
 
 # Firebase 
 sed -i 's|<PROJECT_ID>|<paste_it_here>|g' .env  # Present in downloaded file
 sed -i 's|<GOOGLE_SERVICE_ACCOUNT>.json|<paste_it_here>|g' .env # Name of the file <downloaded.json>
 
 # Google Maps
 sed -i 's|<WE_NEED_THIS>|<paste_it_here>|g' .env
 
 #Verify
 grep -v '^#' .env
 
 ```
In the ```./admin-portal/src/components/RouteMapEditor.tsx``` edit line 47
- Replace <YOUR_GOOGLE_MAPS_KEY> by ur Google maps API key
 


## 4. Cloud Configuration
 ```bash
 cd ..
 
 aws configure
 # Enter your AWS Access Key, Secret, Region (<REGION>)
 
 
 aws ecr create-repository --repository-name <unique_repo_name>   # Note this repo name for Step 6
 ```
 - In the file ```./infra/terraform.tfvars``` set a unique_bucket_name


## 🧱 5. Infrastructure Deployment (Terraform)
 In ```./infra``` run the below commands
 ```bash
 
 cd infra
 terraform init
 terraform plan
 terraform apply
 
 
 terraform output
 # Note admin_portal_website_endpoint
 
 ```
If you get a “BucketAlreadyExists” error, edit ```./infra/terraform.tfvars``` with a globally unique bucket name and rerun terraform apply.


 ## 🐳 6. Build and Push Backend to AWS ECR
 
 ```bash
 cd ../backend
 
 # 1️⃣ Authenticate Docker with AWS ECR
 aws ecr get-login-password --region <REGION> | \
   docker login --username AWS --password-stdin <aws_account_id>.dkr.ecr.<REGION>.amazonaws.com
 
 # 2️⃣ Build the backend Docker image
 docker build -t transvahan-backend:latest .
 
 # 3️⃣ Tag the image for your ECR repository
 docker tag transvahan-backend:latest \
   <aws_account_id>.dkr.ecr.<REGION>.amazonaws.com/<unique_repo_name>:latest
 
 # 4️⃣ Push the image to ECR
 docker push <aws_account_id>.dkr.ecr.<REGION>.amazonaws.com/<unique_repo_name>:latest
```

## 7. Deploy Backend on AWS App Runner
 - Go to AWS Console → App Runner
 - Create service
 - Choose "Container registry" → "Amazon ECR"
 - Select your uploaded image (<unique_repo_name>)
 - Port: 5001
 - Deployment: Automatic (to redeploy on image push)
 - Service name: transvahan-backend
 - Allow public access

 The above step will take time to deploy
 
 - Once deployed, note down the service URL (e.g. https://abcdefghi.<REGION>.awsapprunner.com)
 - This is ur <APP_RUNNER_BACKEND_URL> 
 - And make sure that what ever u have copied looks like this abcdefghi.<REGION>.awsapprunner.com

 ### Health Check
 ```bash
 
 curl -i https://<APP_RUNNER_URL>/health
 
 # Should Return {"ok": true}
```

## 🧩 8. Environment Variables Setup -2 (Admin Portal)

In the ```./admin-portal``` run the following commands
 ```bash
 cd admin-portal

 # Replace App Runner backend URL
 sed -i 's|<APP_RUNNER_BACKEND_URL>|<paste_it_here>|g' .env
 
 # Replace Google Maps API key
 sed -i 's|<YOUR_GOOGLE_MAPS_KEY>|<paste_it_here>|g' .env

 ```

 ## 🌐 9. Build and Deploy Admin Portal
 In the ```./admin-portal``` run the following commands

 ```bash
 npm install
 npm run build
 
 # Upload to the Terraform-created bucket
BUCKET_NAME=$(terraform output -raw admin_portal_bucket_name)
aws s3 sync dist/ s3://$BUCKET_NAME --delete
```
You can now access your admin portal via the website endpoint printed by Terraform.


## 📱 10. Environment Variables Setup -3 (Mobile App)
 In `/transvahan-user` directory run the following commands
 
 ```bash
 
 
 # Replace the API Base URL (App Runner backend endpoint)
 sed -i 's|<APP_RUNNER_BACKEND_URL>|<paste_it_here>|g' .env
 
 # Replace the Google Maps API key
 sed -i 's|<YO<WE_NEED_THIS>>|<paste_it_here>|g' .env
 
 # Verify 
 grep -v '^#' .env
 ```
 Also open `transvahan-user/eas.json` and set:
```bash
"env": {
  "API_BASE_URL": "https://<APP_RUNNER_BACKEND_URL>",
  "WS_URL": "wss://<APP_RUNNER_BACKEND_URL>/ws",
  "USE_MOCK": "false",
  "GOOGLE_MAPS_API_KEY": "<your_maps_key>"
}
```

 ## 11. Build Mobile App (APK)

 - Create an account in `https://expo.dev/` 
 - The above Credentials will be used in `eas login`
 ```bash
 # Ensure EAS CLI is installed
npm install -g eas-cli

cd transvahan-user
eas login

# First build attempt
eas build --platform android --profile production

# If you see "Missing eas.projectId":
# Open transvahan-user/app.config.ts and add:
# eas: { projectId: "your-eas-project-id" },

# Then rebuild
eas build --platform android --profile production


 ```

 ## 📲 12. Download and Install the APK

After the build completes, visit the EAS dashboard link printed in your terminal, or list your builds:
```bash
eas build:list
```

Download the .apk, install it on your Android device, and enjoy your working TransVahan app 🚖
 

 ## ✅ Quick Reference

 ### ✅ Quick Reference

| Step | Purpose | Command |
|------|----------|----------|
| **Terraform Infra** | Provision AWS resources (S3, IAM, etc.) | `cd infra && terraform apply` |
| **Build Backend** | Build Node.js backend Docker image | `docker build -t transvahan-backend .` |
| **Push to ECR** | Push image to AWS Elastic Container Registry | `docker push <repo_uri>:latest` |
| **Deploy App Runner** | Deploy backend container to App Runner | *Use AWS Console* |
| **Sync Frontend** | Upload built admin portal to S3 | `aws s3 sync dist/ s3://<bucket>` |
| **Build APK** | Build mobile app using Expo EAS | `eas build --platform android` |




---

**Author:** Team StormCrafters  
**Region:** `<REGION>`  
**Stack:** Node.js • React • React Native • Firebase • AWS • Terraform  
**Version:** 1.0.0

---
 
 
 
