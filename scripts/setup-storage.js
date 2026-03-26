const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://eawfhchyytnsewgnbznm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhd2ZoY2h5eXRuc2V3Z25iem5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk5NjQ2OSwiZXhwIjoyMDg5NTcyNDY5fQ.57kJ6h03C6bm_z2kHuWazvZ88yiJNsU-qqsd6CF1iP0'
);

async function setup() {
  const buckets = [
    { id: 'deal-documents', name: 'deal-documents', public: false },
    { id: 'kyc-documents', name: 'kyc-documents', public: false },
  ];

  for (const bucket of buckets) {
    const { error } = await supabase.storage.createBucket(bucket.id, {
      public: bucket.public,
      fileSizeLimit: 20 * 1024 * 1024, // 20MB
      allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
    });
    if (error && !error.message.includes('already exists')) {
      console.error(`Failed to create ${bucket.id}:`, error.message);
    } else {
      console.log(`Bucket ${bucket.id}: OK`);
    }
  }
}

setup();
