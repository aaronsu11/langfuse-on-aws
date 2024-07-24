import * as cdk from "aws-cdk-lib";
import { CfnOutput, Stack, StackProps, SecretValue } from "aws-cdk-lib";
import * as apprunner from "@aws-cdk/aws-apprunner-alpha";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecrDeploy from "cdk-ecr-deployment";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as rds from "aws-cdk-lib/aws-rds";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export class LangfuseStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Get context variables
    // Required for successful authentication via OAUTH.
    const nextAuthUrl =
      this.node.tryGetContext("nextAuthUrl") || "http://localhost:3000";
    const imageTag = this.node.tryGetContext("imageTag") || "latest";

    // Create a VPC for RDS and App Runner
    const vpc = new ec2.Vpc(this, "LangfuseVPC", {
      maxAzs: 2,
      natGateways: 1,
    });

    // Create Aurora Serverless v1 PostgreSQL cluster
    const cluster = new rds.ServerlessCluster(this, "AuroraCluster", {
      clusterIdentifier: "LangfuseDBCluster",
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_13_12,
      }),
      vpc,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }),
      // Scale to and from zero with auto pause/resume
      // See https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v1.how-it-works.html#aurora-serverless.how-it-works.pause-resume
      scaling: {
        autoPause: cdk.Duration.minutes(30), // Auto pause after 15 minutes of inactivity
        minCapacity: rds.AuroraCapacityUnit.ACU_2,
        maxCapacity: rds.AuroraCapacityUnit.ACU_4, // Allow scaling up to 4 ACUs
      },
      enableDataApi: true, // Enable Data API for easier querying
      deletionProtection: true, // Set to true in production
      credentials: rds.Credentials.fromGeneratedSecret("langfusedbadmin", {
        secretName: "LANGFUSE_DB_CREDENTIALS",
      }),
      defaultDatabaseName: "LangfuseDB",
    });

    const dbSecret = cluster.secret!;

    // Create a Cognito User Pool
    // const userPool = new cognito.UserPool(this, "UserPool", {
    //   userPoolName: "LangfuseUserPool",
    //   selfSignUpEnabled: true,
    //   signInAliases: { email: true },
    //   autoVerify: { email: true },
    //   passwordPolicy: {
    //     minLength: 8,
    //     requireLowercase: true,
    //     requireUppercase: true,
    //     requireDigits: true,
    //     requireSymbols: false,
    //   },
    // });

    // Create a Cognito User Pool Client
    // const userPoolClient = new cognito.UserPoolClient(this, "UserPoolClient", {
    //   userPool,
    //   generateSecret: true,
    //   oAuth: {
    //     callbackUrls: [`${nextAuthUrl}/api/auth/callback/cognito`],
    //     logoutUrls: [nextAuthUrl],
    //   },
    // });

    // Store Cognito client secret in Secrets Manager
    // const cognitoClientSecret = new secretsmanager.Secret(
    //   this,
    //   "CognitoClientSecret",
    //   {
    //     secretStringValue: userPoolClient.userPoolClientSecret,
    //   }
    // );

    // Create additional secrets
    const nextAuthSecret = new secretsmanager.Secret(this, "NextAuthSecret", {
      secretName: "NEXTAUTH_SECRET",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({}),
        generateStringKey: "secret",
      },
    });

    const langfuseSalt = new secretsmanager.Secret(this, "LangfuseSalt", {
      secretName: "LANGFUSE_SALT",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({}),
        generateStringKey: "salt",
      },
    });

    // Create an ECR repository
    const ecrRepo = new ecr.Repository(this, "LangfuseECRRepo", {
      repositoryName: "langfuse-repo",
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Use RETAIN in production
    });

    // Copy the image from Docker Hub to ECR
    new ecrDeploy.ECRDeployment(this, "DeployDockerImage", {
      src: new ecrDeploy.DockerImageName(`langfuse/langfuse:${imageTag}`),
      dest: new ecrDeploy.DockerImageName(
        `${ecrRepo.repositoryUri}:${imageTag}`
      ),
    });

    // Create an App Runner auto scaling configuration
    const autoScalingConfig = new apprunner.AutoScalingConfiguration(
      this,
      "AutoScalingConfiguration",
      {
        autoScalingConfigurationName: "LangfuseAutoScaling",
        maxConcurrency: 100,
        minSize: 1,
        maxSize: 3,
      }
    );

    const appRunnerSecurityGroup = new ec2.SecurityGroup(this, "AppRunnerSG", {
      vpc,
      allowAllOutbound: true,
      description: "Security group for App Runner",
    });

    cluster.connections.allowDefaultPortFrom(appRunnerSecurityGroup);

    // Update VPC Connector
    const vpcConnector = new apprunner.VpcConnector(
      this,
      "AppRunnerVpcConnector",
      {
        vpc,
        vpcSubnets: vpc.selectSubnets({
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        }),
        securityGroups: [appRunnerSecurityGroup],
      }
    );

    // Create an App Runner service
    const appRunnerService = new apprunner.Service(this, "LangfuseService", {
      serviceName: "Langfuse",
      source: apprunner.Source.fromEcr({
        imageConfiguration: {
          port: 3000,
          environmentVariables: {
            NEXTAUTH_URL: nextAuthUrl,
            // AUTH_COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
            // AUTH_COGNITO_ISSUER: `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
            // AUTH_COGNITO_ALLOW_ACCOUNT_LINKING: "true",
            PORT: "3000",
            HOSTNAME: "0.0.0.0",
            LANGFUSE_CSP_ENFORCE_HTTPS: "false",
            LANGFUSE_DEFAULT_PROJECT_ROLE: "MEMBER",
            ENABLE_EVENT_LOG: "true", // Set to false in production
            LANGFUSE_AUTO_POSTGRES_MIGRATION_DISABLED: "true", // Set to true in production
          },
          environmentSecrets: {
            // DIRECT_URL: apprunner.Secret.fromSecretsManager(
            //   dbSecret,
            //   "connectionString"
            // ),
            DATABASE_HOST: apprunner.Secret.fromSecretsManager(
              dbSecret,
              "host"
            ),
            DATABASE_USERNAME: apprunner.Secret.fromSecretsManager(
              dbSecret,
              "username"
            ),
            DATABASE_PASSWORD: apprunner.Secret.fromSecretsManager(
              dbSecret,
              "password"
            ),
            DATABASE_NAME: apprunner.Secret.fromSecretsManager(
              dbSecret,
              "dbname"
            ),
            NEXTAUTH_SECRET: apprunner.Secret.fromSecretsManager(
              nextAuthSecret,
              "secret"
            ),
            SALT: apprunner.Secret.fromSecretsManager(langfuseSalt, "salt"),
            // AUTH_COGNITO_CLIENT_SECRET:
            //   apprunner.Secret.fromSecretsManager(cognitoClientSecret),
          },
        },
        repository: ecrRepo,
        tagOrDigest: imageTag,
      }),
      cpu: apprunner.Cpu.ONE_VCPU,
      memory: apprunner.Memory.TWO_GB,
      autoScalingConfiguration: autoScalingConfig,
      vpcConnector: vpcConnector,
      healthCheck: apprunner.HealthCheck.http({
        path: "/api/public/health",
        interval: cdk.Duration.seconds(10),
        timeout: cdk.Duration.seconds(10),
        healthyThreshold: 2,
        unhealthyThreshold: 3,
      }),
    });

    // Grant necessary permissions to the App Runner service
    appRunnerService.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
        ],
        resources: [
          dbSecret.secretArn,
          nextAuthSecret.secretArn,
          langfuseSalt.secretArn,
          // cognitoClientSecret.secretArn,
        ],
      })
    );

    // Grant full read/write access to the RDS instance
    appRunnerService.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["rds-db:connect", "rds:DescribeDBInstances"],
        resources: [
          `arn:aws:rds-db:${this.region}:${this.account}:dbuser:${cluster.clusterIdentifier}/*`,
          cluster.clusterArn,
        ],
      })
    );

    // Allow the App Runner service to connect to the VPC
    appRunnerService.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface",
        ],
        resources: ["*"],
      })
    );

    // Outputs
    new CfnOutput(this, "AppRunnerServiceURL", {
      value: appRunnerService.serviceUrl,
    });
    // Langfuse includes a health check endpoint at /api/public/health.
    // This endpoint checks both API functionality and database connectivity.
    new CfnOutput(this, "LangfuseHealthCheckURL", {
      value: `${appRunnerService.serviceUrl}/api/public/health`,
    });
    new CfnOutput(this, "LangfuseDBClusterEndpoint", {
      value: cluster.clusterEndpoint.hostname,
    });
  }
}

const app = new cdk.App();
new LangfuseStack(app, "LangfuseStack");
app.synth();
