import { call } from './lib/rpc';

const setup = await call('system.setup');
console.log('system.setup', JSON.stringify(setup, null, 2));
const health = await call('system.health');
console.log('system.health', JSON.stringify(health, null, 2));
