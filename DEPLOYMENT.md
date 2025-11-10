# SoundClone Deployment Guide

## Overview

This project deploys to AWS ECS with separate dev and prod environments. The deployment pipeline builds and deploys two Docker containers:

1. **Main App** (`soundclone-app`) - The main web application
2. **FFmpeg Service** (`soundclone-ffmpeg`) - Audio processing service
3. **Python Service** (`soundclone-python`) - Currently stubbed out, ready for future deployment

## Architecture

### Environments

- **Dev Environment** - Triggered by pushes to `dev` branch (uses existing `portfolio-dev-cluster`)
- **Prod Environment** - Triggered by pushes to `main` branch (uses existing `portfolio-prod-cluster`)

### Container Architecture

This project uses a **single ECS task** with **three containers**:
1. **portfolio** - Main portfolio site (external, not built by this pipeline)
2. **soundclone-app** - SoundClone web application
3. **soundclone-ffmpeg** - Audio processing service

All three containers run in the same task, allowing them to communicate via localhost.

### Container Images

Images are pushed to AWS ECR with environment-specific tags:
- Dev: `dev-latest`
- Prod: `latest`

## AWS Infrastructure Requirements

### 1. ECR Repositories

Create the following ECR repositories:
- `soundclone-app`
- `soundclone-ffmpeg`
- `soundclone-python` (for future use)

### 2. ECS Clusters (Existing)

- `portfolio-dev-cluster` (shared with portfolio app)
- `portfolio-prod-cluster` (shared with portfolio app)

### 3. ECS Services (Existing)

**Dev Environment:**
- `portfolio-dev-service` (single service with 3-container task)

**Prod Environment:**
- `portfolio-prod-service` (single service with 3-container task)

### 4. ECS Task Definition

Your ECS task definition should include all three containers:

```json
{
  "family": "portfolio-task",
  "containerDefinitions": [
    {
      "name": "portfolio",
      "image": "<ECR_REGISTRY>/portfolio:latest",
      "portMappings": [{"containerPort": 3000}]
    },
    {
      "name": "soundclone-app",
      "image": "<ECR_REGISTRY>/soundclone-app:latest",
      "portMappings": [{"containerPort": 10000}],
      "environment": [
        {"name": "MICRO_REGISTRY_URL", "value": "http://localhost:10000"},
        {"name": "AWS_REGION", "value": "us-east-1"}
      ]
    },
    {
      "name": "soundclone-ffmpeg",
      "image": "<ECR_REGISTRY>/soundclone-ffmpeg:latest",
      "portMappings": [{"containerPort": 10001}],
      "environment": [
        {"name": "MICRO_REGISTRY_URL", "value": "http://localhost:10000"}
      ]
    }
  ]
}
```

### 5. IAM Setup

#### Deployment User (for GitHub Actions)

The deployment pipeline uses AWS access keys for a deployment IAM user.

**Required Permissions:**
- `ecr:GetAuthorizationToken`
- `ecr:BatchCheckLayerAvailability`
- `ecr:GetDownloadUrlForLayer`
- `ecr:BatchGetImage`
- `ecr:PutImage`
- `ecr:InitiateLayerUpload`
- `ecr:UploadLayerPart`
- `ecr:CompleteLayerUpload`
- `ecs:UpdateService`
- `ecs:DescribeServices`

#### Runtime Role (for ECS Tasks)

The ECS task execution role needs:
- S3 access for audio file storage
- CloudWatch Logs write access
- ECR image pull permissions
- Any other AWS service permissions needed by the apps

## GitHub Secrets Configuration

Set up the following secrets in your GitHub repository:

### Required Secrets

1. `AWS_ACCESS_KEY_ID` - Access key for deployment user
2. `AWS_SECRET_ACCESS_KEY` - Secret key for deployment user

## Deployment Workflow

### Automatic Deployments

The deployment happens automatically when code is pushed to `dev` or `main` branches:

1. Code is checked out
2. AWS credentials are configured using access keys
3. Docker images are built for both SoundClone containers
4. Images are pushed to ECR with appropriate tags (`dev-latest` or `latest`)
5. ECS service is updated to trigger deployment (pulls new images for all containers in the task)

### Manual Deployment

To manually trigger a deployment:

```bash
# Force push to trigger workflow
git commit --allow-empty -m "Trigger deployment"
git push origin dev  # or main for prod
```

## Environment Variables

The following environment variables are set in the containers:

### Main App
- `MICRO_REGISTRY_URL` - Service discovery URL
- `ADMIN_USER` - Admin username
- `ADMIN_SECRET` - Admin password
- `AWS_REGION` - AWS region
- `S3_BUCKET_NAME` - S3 bucket for storage
- `S3_PREFIX` - S3 key prefix

### FFmpeg Service
- `MICRO_REGISTRY_URL` - Service discovery URL

Configure these in your ECS task definitions.

## Adding Python Service

When ready to deploy the Python service:

1. Uncomment the Python build steps in `.github/workflows/aws-ecs.yml`
2. Add the `soundclone-python` container to your ECS task definition
3. Update the task definition in Terraform/AWS Console
4. Push to trigger deployment (the service update will use the new task definition)

## Monitoring

- View deployment status in GitHub Actions tab
- Check ECS service status in AWS Console
- View application logs in CloudWatch Logs

## Troubleshooting

### Build Failures

- Check GitHub Actions logs for build errors
- Verify Dockerfile syntax
- Ensure all dependencies are available

### Deployment Failures

- Check ECS service events in AWS Console
- Verify IAM role permissions
- Check task definition configuration
- Verify ECR repository exists and is accessible

### Service Health

- Check ECS task health in AWS Console
- View CloudWatch Logs for application errors
- Verify network configuration (VPC, subnets, security groups)

