-- ==============================================================
--  DATABASE: PlantScope - GIS-Enabled Reforestation System
-- ==============================================================
--  Modules Covered:
--  1. User & Access Management
--  2. Site & Dataset Management
--  3. General Map (GIS Integration)
--  4. Image Analysis / Results
--  5. Monitoring
--  6. Reports / Dashboard
--  7. History (Recordkeeping)
-- ==============================================================

-- Enable PostGIS for spatial data
CREATE EXTENSION IF NOT EXISTS postgis;

-- ==============================================================
-- 1️⃣ USER & ACCESS MANAGEMENT MODULE
-- ==============================================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(30) CHECK (role IN ('Admin', 'Analyst', 'Field Officer')) DEFAULT 'Field Officer',
    is_active BOOLEAN DEFAULT TRUE,
    date_joined TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================
-- 2️⃣ SITE & DATASET MANAGEMENT MODULE
-- ==============================================================

CREATE TABLE sites (
    id SERIAL PRIMARY KEY,
    site_name VARCHAR(150) NOT NULL,
    description TEXT,
    coordinates GEOGRAPHY(POINT, 4326), -- Latitude, Longitude
    area_size DECIMAL(10, 2), -- hectares
    vegetation_type VARCHAR(100),
    soil_type VARCHAR(100),
    slope_percentage DECIMAL(5,2),
    status VARCHAR(50) DEFAULT 'Pending',
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE datasets (
    id SERIAL PRIMARY KEY,
    site_id INT REFERENCES sites(id) ON DELETE CASCADE,
    dataset_name VARCHAR(150),
    data_file_path TEXT, -- Uploaded file path
    data_type VARCHAR(50), -- Excel, CSV, Manual Input
    upload_status VARCHAR(50) DEFAULT 'Validated',
    uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
    date_uploaded TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================
-- 3️⃣ IMAGE ANALYSIS / RESULTS MODULE
-- ==============================================================

CREATE TABLE image_analysis (
    id SERIAL PRIMARY KEY,
    site_id INT REFERENCES sites(id) ON DELETE CASCADE,
    image_path TEXT,
    vegetation_index DECIMAL(6,3),
    canopy_density DECIMAL(6,3),
    priority_score DECIMAL(6,3), -- computed value for planting priority
    analyzed_by INT REFERENCES users(id) ON DELETE SET NULL,
    analysis_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================
-- 4️⃣ MONITORING MODULE
-- ==============================================================

CREATE TABLE monitoring (
    id SERIAL PRIMARY KEY,
    site_id INT REFERENCES sites(id) ON DELETE CASCADE,
    officer_id INT REFERENCES users(id) ON DELETE SET NULL,
    activity VARCHAR(150),
    remarks TEXT,
    condition_rating INT CHECK (condition_rating BETWEEN 1 AND 10),
    photo_path TEXT,
    monitoring_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================
-- 5️⃣ REPORTS & DASHBOARD MODULE
-- ==============================================================

CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    site_id INT REFERENCES sites(id) ON DELETE CASCADE,
    report_type VARCHAR(100), -- e.g. "Monthly Summary", "Analysis Report"
    report_file_path TEXT,
    generated_by INT REFERENCES users(id) ON DELETE SET NULL,
    date_generated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================
-- 6️⃣ HISTORY / RECORDKEEPING MODULE
-- ==============================================================

CREATE TABLE activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255),
    module VARCHAR(100),
    details TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================
-- 7️⃣ RELATIONSHIP VIEWS (Optional)
-- ==============================================================

-- View combining site with its latest analysis and monitoring
CREATE VIEW site_summary AS
SELECT
    s.id AS site_id,
    s.site_name,
    s.area_size,
    s.status,
    ia.priority_score,
    m.condition_rating AS latest_condition,
    m.monitoring_date AS last_monitored
FROM sites s
LEFT JOIN image_analysis ia ON ia.site_id = s.id
LEFT JOIN monitoring m ON m.site_id = s.id
ORDER BY s.id;

