import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as cr from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import path from "path";
import { Connection } from "./connection";

export interface DatabaseProps {
  /**
   * Connection required to connect to the Postgresql server
   */
  connection: Connection;

  /**
   * The name of the database. Must be unique on the PostgreSQL server instance where it is configured.
   */
  name: string;

  /**
   * The role name of the user who will own the database
   */
  owner: string;
}

export class Database extends Construct {
  public readonly name: string;

  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id);

    const { connection, name, owner } = props;

    const provider = this.ensureSingletonProvider(connection);

    const cr = new cdk.CustomResource(this, "CustomResource", {
      serviceToken: provider.serviceToken,
      resourceType: "Custom::Postgresql-Database",
      properties: {
        connection: {
          Host: connection.host,
          Port: connection.port || 5432,
          Database: connection.database || "postgres",
          Username: connection.username,
          PasswordArn: connection.password.secretArn,
          PasswordField: connection.passwordField,
          SSLMode: connection.sslMode || "require",
        },
        name,
        owner,
      },
      pascalCaseProperties: true,
    });

    this.name = cr.getAttString("Name");
  }

  /**
   * We want 1 shared provider for multiple Database constructs
   */
  private ensureSingletonProvider(connection: Connection): cr.Provider {
    const constructId = "cdk-postgresql:database:provider";
    const existing = cdk.Stack.of(this).node.tryFindChild(constructId);
    if (existing) {
      return existing as cr.Provider;
    } else {
      const handler = new lambda.NodejsFunction(
        cdk.Stack.of(this),
        constructId + "-handler",
        {
          entry: path.join(__dirname, "database.handler.js"),
          bundling: {
            nodeModules: ["pg", "pg-format"],
          },
          logRetention: logs.RetentionDays.ONE_MONTH,
          timeout: cdk.Duration.seconds(30),
          vpc: connection.vpc,
          vpcSubnets: connection.vpcSubnets,
          securityGroups: connection.securityGroups,
        }
      );

      connection.password.grantRead(handler);

      return new cr.Provider(cdk.Stack.of(this), constructId, {
        onEventHandler: handler,
        logRetention: logs.RetentionDays.ONE_MONTH,
      });
    }
  }
}
