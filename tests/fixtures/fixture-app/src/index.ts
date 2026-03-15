import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';

async function init() {
  const result = await invoke('greet', { name: 'World' });
  console.log(result);
  
  await listen('ping', (event) => {
    console.log('Received:', event.payload);
  });
}

init();
