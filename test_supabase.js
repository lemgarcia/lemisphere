require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data: goals, error: goalsError } = await supabase.from('goals').select('*').limit(5);
  console.log('Goals Error:', goalsError);
  console.log('Goals Count:', goals ? goals.length : 0);
  if (goals && goals.length > 0) {
    console.log('Sample Goal:', goals[0]);
  }
}

check();
