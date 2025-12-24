const { config } = require('dotenv');
const { resolve } = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function resetIndexerState() {
  console.log('🔄 Resetting indexer state...');

  const { error } = await supabase
    .from('indexer_state')
    .delete()
    .eq('indexer_name', 'coinflip_events');

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log('✅ Indexer state reset! The indexer will start fresh on next run.');
  process.exit(0);
}

resetIndexerState();
