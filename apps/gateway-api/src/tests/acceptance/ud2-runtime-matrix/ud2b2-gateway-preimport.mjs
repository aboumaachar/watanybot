import { pathToFileURL } from 'node:url';

const expectedPort = '4001';
if (process.env.PORT !== expectedPort) {
  console.error(`PREIMPORT_PORT=${process.env.PORT || 'ABSENT'}`);
  process.exitCode = 41;
} else {
  console.log('PREIMPORT_PORT=4001');
  await import(pathToFileURL('C:/xampp/htdocs/projectx/watanybot/apps/gateway-api/src/server.ts').href);
}
