import { createClient } from './app/client.ts';

window.__ModuleLoader__.load({
  id: 'power-dsh',
  factory(require) {
    return createClient(require('react'), require('@deepseek-ai/dsh-client-ui-primitives'));
  },
});
