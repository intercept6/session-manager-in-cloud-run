#!/usr/bin/env zx

import 'zx/globals';
import 'source-map-support/register';
import {
  CreateActivationCommand,
  DeleteActivationCommand,
  DeregisterManagedInstanceCommand,
  SSMClient,
} from '@aws-sdk/client-ssm';
import {exit} from 'process';

const REGION = 'ap-northeast-1';
const ssmClient = new SSMClient({region: REGION});

async function main() {
  console.log('start docker entrypoint');
  const command = process.argv.slice(3);

  const {activateId, activateCode} = await createActivate();
  const {instanceId} = await register({activateId, activateCode});

  $`nohup amazon-ssm-agent > /dev/null &`;

  const proc = $`${command[0]} ${command.slice(1)}`;
  // FIXME: https://github.com/google/zx/issues/249#issuecomment-971710172
  proc.catch(() => {});

  process.on('SIGTERM', async () => {
    console.log('docker-entroypoint.ts: SIGTERM received, terminate server.');
    await Promise.all([
      proc.kill('SIGTERM'),
      terminate({activateId, instanceId}),
    ]);
    exit();
  });

  process.on('SIGINT', async () => {
    console.log('docker-entroypoint.ts: SIGINT received, terminate server.');
    await Promise.all([
      proc.kill('SIGINT'),
      terminate({activateId, instanceId}),
    ]);
    exit();
  });
}

type ActivateParams = {activateId: string; activateCode: string};

async function createActivate(): Promise<ActivateParams> {
  const command = new CreateActivationCommand({
    DefaultInstanceName: 'cloud-run-dev',
    Description: 'cloud-run-dev',
    IamRole: 'service-role/AmazonEC2RunCommandRoleForManagedInstances',
  });
  const {ActivationId: activateId, ActivationCode: activateCode} =
    await ssmClient.send(command);

  console.log(`create activate id: ${activateId}`);

  return {
    activateId,
    activateCode,
  };
}

async function register({
  activateId,
  activateCode,
}: ActivateParams): Promise<{instanceId: string}> {
  console.log(activateCode);
  const {stdout, stderr} =
    await $`amazon-ssm-agent -register -id ${activateId} -code ${activateCode} -region ${REGION} -y`;

  const regex = /mi-.*/;
  const found = stdout.match(regex);

  if (found.length !== 1) {
    throw new Error(
      `Failed to get instance id. stdour: ${stdout}, stderr: ${stderr}`
    );
  }

  const instanceId = found[0];

  console.log(`register instance id: ${instanceId}`);

  return {instanceId};
}

type TerminateParams = {activateId: string; instanceId: string};
async function terminate({activateId, instanceId}: TerminateParams) {
  await Promise.all([deleteActivate({activateId}), deregister({instanceId})]);
}

async function deleteActivate({
  activateId,
}: {
  activateId: string;
}): Promise<void> {
  const command = new DeleteActivationCommand({ActivationId: activateId});
  await ssmClient.send(command).catch(console.error);

  console.log(`delete activate id: ${activateId}`);
}

async function deregister({instanceId}: {instanceId: string}): Promise<void> {
  const command = new DeregisterManagedInstanceCommand({
    InstanceId: instanceId,
  });
  await ssmClient.send(command).catch(console.error);

  console.log(`deregister instance id: ${instanceId}`);
}

(async () => {
  await main();
})();
