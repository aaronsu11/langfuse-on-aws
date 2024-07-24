# Langfuse AWS CDK Deployment

This project contains an AWS CDK stack for deploying [Langfuse](https://langfuse.com/), an open-source observability and analytics platform for LLM applications with traces, evals, prompt management and metrics.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Core Components](#core-components)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [Customization](#customization)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Overview

This CDK stack deploys Langfuse on AWS using services such as [App Runner](https://aws.amazon.com/apprunner/), [Aurora Serverless](https://aws.amazon.com/rds/aurora/serverless/) PostgreSQL, and Secrets Manager. It provides a scalable and serverless infrastructure for running Langfuse.

## Prerequisites

- AWS Account and configured AWS CLI with Administrator access
- Node.js (v18.x or later)
- AWS CDK CLI (`npm install -g aws-cdk`)

Note: if you are new to CDK, checkout this "[An Introduction to AWS CDK](https://youtu.be/nlb8yo7SZ2I?si=owtTmdh1778Dxcqe)" video and the AWS documentation on [Getting Started with the AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html).

## Core Components

1. **VPC**: A Virtual Private Cloud for network isolation.
2. **Aurora Serverless**: PostgreSQL-compatible database for Langfuse.
3. **App Runner**: Hosts the Langfuse application.
4. **ECR**: Stores the Langfuse Docker image.
5. **Secrets Manager**: Manages sensitive information like database credentials.

## Deployment

1. Clone this repository:

    ```bash
    git clone https://github.com/aaronsu11/langfuse-on-aws.git
    cd langfuse-on-aws
    ```
2. Install dependencies:

    ```bash
    npm install
    ```

3. Deploy the stack:
    
    ```bash
    cdk deploy -c nextAuthUrl=https://<your-app-runner-domain> -c imageTag=latest
    ```
You can omit the `-c nextAuthUrl=https://<your-app-runner-domain>` parameter for the first deployment, which will default to `http://localhost:3000`. This URL is used for the sign-in and log-out redirects.

4. After first deployment, CDK will output important information like the App Runner service URL to access the Langfuse application. Replace `https://<your-app-runner-domain>` with the service URL or the custom domain and re-deploy to complete the setup. You can also replace `imageTag=latest` with the desired Langfuse image tag. See [Langfuse documentation](https://langfuse.com/docs) for available tags.

## Configuration

The stack can be configured using CDK context variables:

- `nextAuthUrl`: The URL for NextAuth authentication (default: "http://localhost:3000")
- `imageTag`: The Docker image tag for Langfuse (default: "latest")

You can set these in `cdk.json` or pass them during deployment as shown above.

## Customization

- **Database Scaling**: Adjust the `autoPause`, `minCapacity` and `maxCapacity` in the `ServerlessCluster` configuration to change database scaling behavior.
- **App Runner Scaling**: Modify the `AutoScalingConfiguration` to adjust the application's scaling parameters.

## Troubleshooting

- Check App Runner logs for application-specific issues.
- Verify VPC and security group configurations if there are connectivity issues.
- Ensure all required secrets are properly set in Secrets Manager.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the [MIT License](LICENSE).