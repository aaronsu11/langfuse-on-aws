import * as cdk from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import * as LangfuseAws from "../lib/langfuse-aws-stack";

describe("LangfuseStack", () => {
  let app: cdk.App;
  let stack: LangfuseAws.LangfuseStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App({
      context: {
        nextAuthUrl: "http://localhost:3000",
        imageTag: "2",
      },
    });
    stack = new LangfuseAws.LangfuseStack(app, "TestStack");
    template = Template.fromStack(stack);
  });

  test("VPC Created", () => {
    template.resourceCountIs("AWS::EC2::VPC", 1);
    template.hasResourceProperties("AWS::EC2::VPC", {
      CidrBlock: "10.0.0.0/16",
      EnableDnsHostnames: true,
      EnableDnsSupport: true,
    });
  });

  test("Aurora Serverless Cluster Created", () => {
    template.resourceCountIs("AWS::RDS::DBCluster", 1);
    template.hasResourceProperties("AWS::RDS::DBCluster", {
      Engine: "aurora-postgresql",
      EngineMode: "serverless",
      EngineVersion: Match.anyValue(),
      DatabaseName: "LangfuseDB",
      ScalingConfiguration: Match.objectLike({
        AutoPause: true,
        MinCapacity: 2,
        MaxCapacity: 4,
      }),
    });
  });

  test("Secrets Created", () => {
    template.resourceCountIs("AWS::SecretsManager::Secret", 3);
    template.hasResourceProperties("AWS::SecretsManager::Secret", {
      Name: Match.stringLikeRegexp("LANGFUSE_DB_CREDENTIALS"),
    });
    template.hasResourceProperties("AWS::SecretsManager::Secret", {
      Name: Match.stringLikeRegexp("NEXTAUTH_SECRET"),
    });
    template.hasResourceProperties("AWS::SecretsManager::Secret", {
      Name: Match.stringLikeRegexp("LANGFUSE_SALT"),
    });
  });

  test("ECR Repository Created", () => {
    template.resourceCountIs("AWS::ECR::Repository", 1);
    template.hasResourceProperties("AWS::ECR::Repository", {
      RepositoryName: Match.stringLikeRegexp("langfuse-repo"),
    });
  });

  test("Outputs Created", () => {
    template.hasOutput("AppRunnerServiceURL", {});
    template.hasOutput("LangfuseHealthCheckURL", {});
    template.hasOutput("LangfuseDBClusterEndpoint", {});
  });
});
