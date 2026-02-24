-- Add this to scripts/startup.js database initialization

CREATE TABLE IF NOT EXISTS booking_requests (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  phone VARCHAR(50),
  room VARCHAR(50) NOT NULL,
  day VARCHAR(20) NOT NULL,
  start_time VARCHAR(10) NOT NULL,
  duration INTEGER DEFAULT 1,
  purpose TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_booking_status ON booking_requests(status);
CREATE INDEX IF NOT EXISTS idx_booking_created ON booking_requests(created_at DESC);
