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

This CDK stack deploys Langfuse on AWS using services such as [AWS App Runner](https://aws.amazon.com/apprunner/), [Aurora Serverless](https://aws.amazon.com/rds/aurora/serverless/) PostgreSQL, and Secrets Manager. It provides a scalable and serverless infrastructure for running Langfuse.

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

2. Install CDK dependencies:

    ```bash
    npm install
    ```

3. Deploy the stack:
    
    ```bash
    cdk deploy
    ```

    Note that by default, the `nextAuthUrl` will be set to `http://localhost:3000`. This URL is used for the sign-in and log-out redirects. You will need to update this in the next step to make the application work correctly.

4. After first deployment, CDK will output important information like the App Runner service URL to access the Langfuse application. For example, in the terminal output you will see:

    ```
    ...
    Outputs:
    LangfuseStack.AppRunnerServiceURL = <app ID>.<region>.awsapprunner.com
    ...
    ```
    Note down the App Runner service URL for the next step.

5. Update the `-c nextAuthUrl=https://<AppRunnerServiceURL>` context variable with the App Runner service URL from the output and re-deploy the stack:

    ```bash
    cdk deploy -c nextAuthUrl=https://<AppRunnerServiceURL> -c imageTag=latest
    ```

    The `nextAuthUrl` should be effective without restarting the container. You can also replace `imageTag=latest` with the desired Langfuse image tag. A replacement of the container will happen if the image tag is changed. See [Langfuse documentation](https://langfuse.com/docs) for available tags.


## Configuration

Instead of passing context (`-c`) during deployment, you can also configure the stack using the `cdk.json` file. For example:

```json
{
  "context": {
    "nextAuthUrl": "https://<AppRunnerServiceURL>",
    "imageTag": "latest"
  }
}
```

- `nextAuthUrl`: The URL for NextAuth authentication (default: "http://localhost:3000")
- `imageTag`: The Docker image tag for Langfuse (default: "latest")

## Customization

In addition, it's recommended to review these setting in the [langfuse-aws-stack.ts](lib/langfuse-aws-stack.ts) file depending on your requirements:
* Aurora Serverless database settings
    - `serverlessV2MinCapacity`: Adjust the minimum capacity of the Aurora Serverless v2 database. The lowest value is 0.5 ACU.
    - `serverlessV2MaxCapacity`: Adjust the maximum capacity of the Aurora Serverless v2 database.
    - `storageEncrypted`: Set to `true` to encrypt the database cluster storage.
    - `deletionProtection`: Set to `true` to prevent accidental deletion of the database.
    - `enableDataApi`: Set to `true` to enable the Query Editor in the AWS Console.
* App Runner settings
    - `AutoScalingConfiguration`: Adjust the application's [scaling parameters](https://docs.aws.amazon.com/apprunner/latest/dg/manage-autoscaling.html). You pay for the memory usage of all the provisioned instances. You pay for the CPU usage of only the active subset.
    - `ENABLE_EVENT_LOG`: Set to `false` to disable logging raw events to the events table in the database. This table is useful for debugging your instance but not required to run the application.
    - `LANGFUSE_AUTO_POSTGRES_MIGRATION_DISABLED`: Set to `true` to disable automatic database migrations on docker startup.

## Troubleshooting

- Check App Runner logs for application-specific issues.
- Verify VPC and security group configurations if there are connectivity issues.
- Ensure all required secrets are properly set in Secrets Manager.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the [MIT License](LICENSE).