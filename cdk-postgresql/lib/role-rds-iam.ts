import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { RemovalPolicy } from "aws-cdk-lib";
import { Provider } from "./provider";

export interface RoleRdsIamProps {
  /**
   * Provider required to connect to the Postgresql server
   */
  provider: Provider;

  /**
   * The name of the role. Must be unique on the PostgreSQL server instance where it is configured.
   */
  name: string;

  /**
   * Policy to apply when the role is removed from this stack.
   *
   * @default - The role will be destroyed.
   */
  removalPolicy?: RemovalPolicy;
}

export class RoleRdsIam extends Construct {
  constructor(scope: Construct, id: string, props: RoleRdsIamProps) {
    super(scope, id);

    const { provider, name, removalPolicy } = props;

    const cr = new cdk.CustomResource(this, "CustomResource", {
      serviceToken: provider.serviceToken,
      resourceType: "Custom::Postgresql-RoleRdsIam",
      properties: {
        connection: provider.buildConnectionProperty(),
        name,
      },
      pascalCaseProperties: true,
    });

    cr.applyRemovalPolicy(removalPolicy || cdk.RemovalPolicy.DESTROY);
    cr.node.addDependency(provider);
  }
}
