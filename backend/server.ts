import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';
import jwt, { JwtPayload } from 'jsonwebtoken';
import multer from 'multer';
import archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';
import morgan from 'morgan';

// Import Zod schemas (adapting to what's available in the existing schema)
import { 
  userSchema, 
  createUserInputSchema, 
  updateUserInputSchema,
  searchUserInputSchema,
  userResponseSchema,
  usersListResponseSchema
} from './schema.js';

dotenv.config();

// ESM workaround for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extended Request types
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    full_name: string;
    created_at: Date;
  };
  file?: Express.Multer.File;
}

interface JwtPayloadWithUser extends JwtPayload {
  user_id: string;
  email: string;
}

// Error response utility
interface ErrorResponse {
  success: false;
  message: string;
  error_code?: string;
  details?: any;
  timestamp: string;
}

function createErrorResponse(
  message: string,
  error?: any,
  errorCode?: string
): ErrorResponse {
  const response: ErrorResponse = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };

  if (errorCode) {
    response.error_code = errorCode;
  }

  if (error) {
    response.details = {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return response;
}

const { 
  DATABASE_URL, 
  PGHOST, 
  PGDATABASE, 
  PGUSER, 
  PGPASSWORD, 
  PGPORT = 5432, 
  JWT_SECRET = 'your-secret-key',
  PORT = 3000
} = process.env;

const pool = new Pool(
  DATABASE_URL
    ? { 
        connectionString: DATABASE_URL, 
        ssl: { rejectUnauthorized: false } 
      }
    : {
        host: PGHOST,
        database: PGDATABASE,
        user: PGUSER,
        password: PGPASSWORD,
        port: Number(PGPORT),
        ssl: { rejectUnauthorized: false },
      }
);

const app = express();

// Middleware
app.use(morgan('combined')); // Log all requests
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Storage setup
const storage_dir = path.join(__dirname, 'storage');
if (!fs.existsSync(storage_dir)) {
  fs.mkdirSync(storage_dir, { recursive: true });
}

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, storage_dir);
  },
  filename: (req, file, cb) => {
    const unique_name = `${Date.now()}-${uuidv4()}-${file.originalname}`;
    cb(null, unique_name);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed'));
    }
  }
});

/*
  Initialize portfolio tables if they don't exist
  Working with existing schema but extending for portfolio needs
*/
async function initializePortfolioTables() {
  const client = await pool.connect();
  try {
    // Create portfolio sites table (extending beyond existing posts table)
    await client.query(`
      CREATE TABLE IF NOT EXISTS portfolio_sites (
        site_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        site_title TEXT NOT NULL,
        tagline TEXT,
        hero_image_url TEXT,
        about_text TEXT,
        template_id TEXT,
        primary_color TEXT,
        font_family TEXT,
        is_dark_mode BOOLEAN DEFAULT FALSE,
        seo_title TEXT,
        seo_description TEXT,
        subdomain TEXT UNIQUE,
        published_at TIMESTAMP,
        export_zip_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create portfolio projects table
    await client.query(`
      CREATE TABLE IF NOT EXISTS portfolio_projects (
        project_id TEXT PRIMARY KEY,
        site_id TEXT NOT NULL REFERENCES portfolio_sites(site_id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        date DATE NOT NULL,
        tags TEXT[] DEFAULT '{}',
        demo_url TEXT,
        code_url TEXT,
        images TEXT[] DEFAULT '{}',
        order_index INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create image assets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS image_assets (
        image_id TEXT PRIMARY KEY,
        site_id TEXT REFERENCES portfolio_sites(site_id) ON DELETE CASCADE,
        project_id TEXT REFERENCES portfolio_projects(project_id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        alt_text TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create contact submissions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS contact_submissions (
        submission_id TEXT PRIMARY KEY,
        site_id TEXT REFERENCES portfolio_sites(site_id) ON DELETE SET NULL,
        name TEXT,
        email TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Portfolio tables initialized successfully');
  } catch (error) {
    console.error('Error initializing portfolio tables:', error);
  } finally {
    client.release();
  }
}

// Initialize tables on startup
initializePortfolioTables();

/*
  Authentication middleware for protected routes
  Validates JWT token and attaches user info to request
*/
const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json(createErrorResponse('Access token required', null, 'AUTH_TOKEN_MISSING'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayloadWithUser;
    const result = await pool.query('SELECT id, username, email, full_name, created_at FROM users WHERE id = $1', [decoded.user_id]);
    
    if (result.rows.length === 0) {
      return res.status(401).json(createErrorResponse('Invalid token - user not found', null, 'AUTH_USER_NOT_FOUND'));
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    return res.status(403).json(createErrorResponse('Invalid or expired token', error, 'AUTH_TOKEN_INVALID'));
  }
};

/*
  Generate a unique subdomain for portfolio sites
  Creates a subdomain based on username and ensures uniqueness
*/
async function generateUniqueSubdomain(username) {
  const base_subdomain = username.toLowerCase().replace(/[^a-z0-9]/g, '');
  let subdomain = base_subdomain;
  let counter = 1;

  while (true) {
    const result = await pool.query('SELECT site_id FROM portfolio_sites WHERE subdomain = $1', [subdomain]);
    if (result.rows.length === 0) {
      return subdomain;
    }
    subdomain = `${base_subdomain}${counter}`;
    counter++;
  }
}

/*
  Static site export functionality
  Generates HTML/CSS/JS bundle and creates ZIP file
  @@need:external-api: Static site template engine for generating HTML from portfolio data
*/
async function generateStaticSiteExport(site_id) {
  try {
    // Mock static site generation for now
    const export_filename = `portfolio-${site_id}-${Date.now()}.zip`;
    const export_path = path.join(storage_dir, export_filename);
    
    // Create a mock HTML file for the portfolio
    const mock_html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Portfolio Export</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        .hero { background: #f4f4f4; padding: 60px 20px; text-align: center; }
        .projects { padding: 40px 20px; }
        .project { margin-bottom: 30px; padding: 20px; border: 1px solid #ddd; }
    </style>
</head>
<body>
    <div class="hero">
        <h1>Portfolio Site Export</h1>
        <p>Generated on ${new Date().toISOString()}</p>
    </div>
    <div class="projects">
        <h2>Projects</h2>
        <div class="project">
            <h3>Sample Project</h3>
            <p>This is a mock export. In production, this would contain actual portfolio data.</p>
        </div>
    </div>
</body>
</html>`;

    // Create ZIP file
    const output = fs.createWriteStream(export_path);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise((resolve, reject) => {
      output.on('close', () => {
        resolve(`/storage/${export_filename}`);
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);
      archive.append(mock_html, { name: 'index.html' });
      archive.finalize();
    });
  } catch (error) {
    console.error('Error generating static site export:', error);
    return null;
  }
}

// AUTHENTICATION ENDPOINTS

/*
  Register new portfolio owner
  Creates user account and returns JWT token for immediate access
*/
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password_hash, full_name, avatar_url } = req.body;

    // Validation
    if (!username || !email || !password_hash) {
      return res.status(400).json(createErrorResponse('Username, email and password are required', null, 'MISSING_REQUIRED_FIELDS'));
    }

    if (password_hash.length < 6) {
      return res.status(400).json(createErrorResponse('Password must be at least 6 characters long', null, 'PASSWORD_TOO_SHORT'));
    }

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2', 
      [username, email]
    );
    if (existingUser.rows.length > 0) {
      return res.status(400).json(createErrorResponse('User with this username or email already exists', null, 'USER_ALREADY_EXISTS'));
    }

    // Create user (store password directly for development)
    const user_id = uuidv4();
    const result = await pool.query(
      'INSERT INTO users (id, username, email, password_hash, full_name, avatar_url, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, username, email, full_name, avatar_url, is_active, created_at',
      [user_id, username.trim(), email.toLowerCase().trim(), password_hash, full_name?.trim() || null, avatar_url || null, true]
    );

    const user = result.rows[0];

    // Generate JWT
    const token = jwt.sign(
      { user_id: user.id, email: user.email }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.status(201).json({
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          password_hash: user.password_hash,
          full_name: user.full_name,
          avatar_url: user.avatar_url,
          is_active: user.is_active,
          created_at: user.created_at
        },
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Login existing user
  Validates credentials and returns JWT token
*/
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, email, password_hash } = req.body;
    const login_identifier = username || email;

    if (!login_identifier || !password_hash) {
      return res.status(400).json(createErrorResponse('Username/email and password are required', null, 'MISSING_REQUIRED_FIELDS'));
    }

    // Find user by username or email
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $1', 
      [login_identifier.toLowerCase().trim()]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json(createErrorResponse('Invalid credentials', null, 'INVALID_CREDENTIALS'));
    }

    const user = result.rows[0];

    // Check password (direct comparison for development)
    if (password_hash !== user.password_hash) {
      return res.status(400).json(createErrorResponse('Invalid credentials', null, 'INVALID_CREDENTIALS'));
    }

    // Generate JWT
    const token = jwt.sign(
      { user_id: user.id, email: user.email }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.json({
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          password_hash: user.password_hash,
          full_name: user.full_name,
          avatar_url: user.avatar_url,
          is_active: user.is_active,
          created_at: user.created_at
        },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Logout user
  Invalidates current JWT token (basic implementation)
*/
app.post('/api/auth/logout', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  // In a JWT stateless setup, logout is primarily client-side
  // For enhanced security, could maintain a token blacklist
  res.json({ success: true });
});

// USER ENDPOINTS

/*
  Get public user profile
  Returns publicly visible user information
*/
app.get('/api/users/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;

    const result = await pool.query(
      'SELECT id, username, full_name, avatar_url, is_active, created_at FROM users WHERE id = $1 AND is_active = true',
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(createErrorResponse('User not found', null, 'USER_NOT_FOUND'));
    }

    res.json({
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get public user profile error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// PORTFOLIO SITES ENDPOINTS

/*
  Create new portfolio site
  Initializes a new portfolio site for the authenticated user
*/
app.post('/api/sites', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      site_title, 
      tagline, 
      hero_image_url, 
      about_text, 
      template_id, 
      primary_color, 
      font_family, 
      is_dark_mode = false, 
      seo_title, 
      seo_description 
    } = req.body;

    if (!site_title) {
      return res.status(400).json(createErrorResponse('Site title is required', null, 'MISSING_SITE_TITLE'));
    }

    const site_id = uuidv4();
    const subdomain = await generateUniqueSubdomain(req.user.username);

    const result = await pool.query(`
      INSERT INTO portfolio_sites (
        site_id, user_id, site_title, tagline, hero_image_url, about_text, 
        template_id, primary_color, font_family, is_dark_mode, 
        seo_title, seo_description, subdomain
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      site_id, req.user.id, site_title, tagline, hero_image_url, about_text,
      template_id, primary_color, font_family, is_dark_mode,
      seo_title, seo_description, subdomain
    ]);

    res.status(201).json({
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Create site error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  List user's portfolio sites
  Returns all sites belonging to the authenticated user
*/
app.get('/api/sites', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM portfolio_sites WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );

    res.json({
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('List sites error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Get portfolio site by ID
  Returns detailed site information
*/
app.get('/api/sites/:site_id', async (req, res) => {
  try {
    const { site_id } = req.params;

    const result = await pool.query(
      'SELECT * FROM portfolio_sites WHERE site_id = $1',
      [site_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Site not found', null, 'SITE_NOT_FOUND'));
    }

    res.json({
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get site error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Update portfolio site
  Updates site information with provided data
*/
app.put('/api/sites/:site_id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { site_id } = req.params;
    const updates = req.body;

    // Verify site ownership
    const siteCheck = await pool.query(
      'SELECT user_id FROM portfolio_sites WHERE site_id = $1',
      [site_id]
    );

    if (siteCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Site not found', null, 'SITE_NOT_FOUND'));
    }

    if (siteCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json(createErrorResponse('Access denied', null, 'ACCESS_DENIED'));
    }

    // Build dynamic update query
    const update_fields = [];
    const values = [];
    let value_index = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'site_id' && value !== undefined) {
        update_fields.push(`${key} = $${value_index}`);
        values.push(value);
        value_index++;
      }
    }

    if (update_fields.length === 0) {
      return res.status(400).json(createErrorResponse('No valid fields to update', null, 'NO_UPDATE_FIELDS'));
    }

    update_fields.push(`updated_at = $${value_index}`);
    values.push(new Date());
    value_index++;

    values.push(site_id);

    const query = `
      UPDATE portfolio_sites 
      SET ${update_fields.join(', ')} 
      WHERE site_id = $${value_index}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    res.json({
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update site error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Publish portfolio site
  Sets published timestamp and makes site live
*/
app.put('/api/sites/:site_id/publish', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { site_id } = req.params;

    // Verify site ownership
    const siteCheck = await pool.query(
      'SELECT user_id FROM portfolio_sites WHERE site_id = $1',
      [site_id]
    );

    if (siteCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Site not found', null, 'SITE_NOT_FOUND'));
    }

    if (siteCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json(createErrorResponse('Access denied', null, 'ACCESS_DENIED'));
    }

    const result = await pool.query(`
      UPDATE portfolio_sites 
      SET published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE site_id = $1
      RETURNING *
    `, [site_id]);

    res.json({
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Publish site error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Export portfolio site as static files
  Generates ZIP bundle containing HTML/CSS/JS
*/
app.post('/api/sites/:site_id/export', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { site_id } = req.params;

    // Verify site ownership
    const siteCheck = await pool.query(
      'SELECT user_id FROM portfolio_sites WHERE site_id = $1',
      [site_id]
    );

    if (siteCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Site not found', null, 'SITE_NOT_FOUND'));
    }

    if (siteCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json(createErrorResponse('Access denied', null, 'ACCESS_DENIED'));
    }

    // Generate static site export
    const export_zip_url = await generateStaticSiteExport(site_id);

    if (!export_zip_url) {
      return res.status(500).json(createErrorResponse('Failed to generate export', null, 'EXPORT_GENERATION_FAILED'));
    }

    // Update site with export URL
    await pool.query(
      'UPDATE portfolio_sites SET export_zip_url = $1, updated_at = CURRENT_TIMESTAMP WHERE site_id = $2',
      [export_zip_url, site_id]
    );

    res.json({
      export_zip_url,
      export_path: export_zip_url
    });
  } catch (error) {
    console.error('Export site error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Update site hero section
  Updates hero-specific fields
*/
app.put('/api/sites/:site_id/hero', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { site_id } = req.params;
    const { title, tagline, hero_image_url } = req.body;

    // Verify site ownership
    const siteCheck = await pool.query(
      'SELECT user_id FROM portfolio_sites WHERE site_id = $1',
      [site_id]
    );

    if (siteCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Site not found', null, 'SITE_NOT_FOUND'));
    }

    if (siteCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json(createErrorResponse('Access denied', null, 'ACCESS_DENIED'));
    }

    const result = await pool.query(`
      UPDATE portfolio_sites 
      SET site_title = $1, tagline = $2, hero_image_url = $3, updated_at = CURRENT_TIMESTAMP
      WHERE site_id = $4
      RETURNING *
    `, [title, tagline, hero_image_url, site_id]);

    res.json({
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update hero error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Update site about section
  Updates about text and avatar
*/
app.put('/api/sites/:site_id/about', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { site_id } = req.params;
    const { bio, avatar_url } = req.body;

    // Verify site ownership
    const siteCheck = await pool.query(
      'SELECT user_id FROM portfolio_sites WHERE site_id = $1',
      [site_id]
    );

    if (siteCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Site not found', null, 'SITE_NOT_FOUND'));
    }

    if (siteCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json(createErrorResponse('Access denied', null, 'ACCESS_DENIED'));
    }

    const result = await pool.query(`
      UPDATE portfolio_sites 
      SET about_text = $1, updated_at = CURRENT_TIMESTAMP
      WHERE site_id = $2
      RETURNING *
    `, [bio, site_id]);

    // Also update user avatar if provided
    if (avatar_url) {
      await pool.query(
        'UPDATE users SET avatar_url = $1 WHERE id = $2',
        [avatar_url, req.user.id]
      );
    }

    res.json({
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update about error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Update site SEO settings
  Updates SEO title and description
*/
app.put('/api/sites/:site_id/seo', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { site_id } = req.params;
    const { seo_title, seo_description } = req.body;

    // Verify site ownership
    const siteCheck = await pool.query(
      'SELECT user_id FROM portfolio_sites WHERE site_id = $1',
      [site_id]
    );

    if (siteCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Site not found', null, 'SITE_NOT_FOUND'));
    }

    if (siteCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json(createErrorResponse('Access denied', null, 'ACCESS_DENIED'));
    }

    const result = await pool.query(`
      UPDATE portfolio_sites 
      SET seo_title = $1, seo_description = $2, updated_at = CURRENT_TIMESTAMP
      WHERE site_id = $3
      RETURNING *
    `, [seo_title, seo_description, site_id]);

    res.json({
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update SEO error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Update site theme settings
  Updates template, colors, and typography
*/
app.put('/api/sites/:site_id/theme', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { site_id } = req.params;
    const { template_id, primary_color, font_family, is_dark_mode } = req.body;

    // Verify site ownership
    const siteCheck = await pool.query(
      'SELECT user_id FROM portfolio_sites WHERE site_id = $1',
      [site_id]
    );

    if (siteCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Site not found', null, 'SITE_NOT_FOUND'));
    }

    if (siteCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json(createErrorResponse('Access denied', null, 'ACCESS_DENIED'));
    }

    const result = await pool.query(`
      UPDATE portfolio_sites 
      SET template_id = $1, primary_color = $2, font_family = $3, is_dark_mode = $4, updated_at = CURRENT_TIMESTAMP
      WHERE site_id = $5
      RETURNING *
    `, [template_id, primary_color, font_family, is_dark_mode, site_id]);

    res.json({
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update theme error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// PORTFOLIO PROJECTS ENDPOINTS

/*
  List projects for a site
  Returns all projects belonging to a specific site
*/
app.get('/api/sites/:site_id/projects', async (req, res) => {
  try {
    const { site_id } = req.params;

    const result = await pool.query(
      'SELECT * FROM portfolio_projects WHERE site_id = $1 ORDER BY order_index ASC, created_at DESC',
      [site_id]
    );

    res.json({
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('List projects error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Create new project for a site
  Adds a new project to the specified portfolio site
*/
app.post('/api/sites/:site_id/projects', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { site_id } = req.params;
    const { title, description, date, tags = [], demo_url, code_url, images = [], order_index = 0 } = req.body;

    if (!title || !description || !date) {
      return res.status(400).json(createErrorResponse('Title, description, and date are required', null, 'MISSING_REQUIRED_FIELDS'));
    }

    // Verify site ownership
    const siteCheck = await pool.query(
      'SELECT user_id FROM portfolio_sites WHERE site_id = $1',
      [site_id]
    );

    if (siteCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Site not found', null, 'SITE_NOT_FOUND'));
    }

    if (siteCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json(createErrorResponse('Access denied', null, 'ACCESS_DENIED'));
    }

    const project_id = uuidv4();

    const result = await pool.query(`
      INSERT INTO portfolio_projects (
        project_id, site_id, title, description, date, tags, demo_url, code_url, images, order_index
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [project_id, site_id, title, description, date, tags, demo_url, code_url, images, order_index]);

    res.status(201).json({
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Update existing project
  Updates project information with provided data
*/
app.put('/api/sites/:site_id/projects/:project_id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { site_id, project_id } = req.params;
    const updates = req.body;

    // Verify project exists and user has access
    const projectCheck = await pool.query(`
      SELECT pp.*, ps.user_id 
      FROM portfolio_projects pp 
      JOIN portfolio_sites ps ON pp.site_id = ps.site_id 
      WHERE pp.project_id = $1 AND pp.site_id = $2
    `, [project_id, site_id]);

    if (projectCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Project not found', null, 'PROJECT_NOT_FOUND'));
    }

    if (projectCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json(createErrorResponse('Access denied', null, 'ACCESS_DENIED'));
    }

    // Build dynamic update query
    const update_fields = [];
    const values = [];
    let value_index = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id' && key !== 'project_id' && key !== 'site_id' && value !== undefined) {
        update_fields.push(`${key} = $${value_index}`);
        values.push(value);
        value_index++;
      }
    }

    if (update_fields.length === 0) {
      return res.status(400).json(createErrorResponse('No valid fields to update', null, 'NO_UPDATE_FIELDS'));
    }

    update_fields.push(`updated_at = $${value_index}`);
    values.push(new Date());
    value_index++;

    values.push(project_id);

    const query = `
      UPDATE portfolio_projects 
      SET ${update_fields.join(', ')} 
      WHERE project_id = $${value_index}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    res.json({
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Delete project
  Removes project and associated assets
*/
app.delete('/api/sites/:site_id/projects/:project_id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { site_id, project_id } = req.params;

    // Verify project exists and user has access
    const projectCheck = await pool.query(`
      SELECT pp.*, ps.user_id 
      FROM portfolio_projects pp 
      JOIN portfolio_sites ps ON pp.site_id = ps.site_id 
      WHERE pp.project_id = $1 AND pp.site_id = $2
    `, [project_id, site_id]);

    if (projectCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Project not found', null, 'PROJECT_NOT_FOUND'));
    }

    if (projectCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json(createErrorResponse('Access denied', null, 'ACCESS_DENIED'));
    }

    const project = projectCheck.rows[0];

    // Delete associated image assets
    await pool.query('DELETE FROM image_assets WHERE project_id = $1', [project_id]);

    // Delete project
    await pool.query('DELETE FROM portfolio_projects WHERE project_id = $1', [project_id]);

    res.json({
      data: project
    });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Upload image for project
  Handles file upload and creates image asset record
*/
app.post('/api/sites/:site_id/projects/:project_id/images', authenticateToken, upload.single('image'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { site_id, project_id } = req.params;
    const { alt_text } = req.body;

    if (!req.file) {
      return res.status(400).json(createErrorResponse('No image file provided', null, 'NO_IMAGE_FILE'));
    }

    // Verify project exists and user has access
    const projectCheck = await pool.query(`
      SELECT pp.*, ps.user_id 
      FROM portfolio_projects pp 
      JOIN portfolio_sites ps ON pp.site_id = ps.site_id 
      WHERE pp.project_id = $1 AND pp.site_id = $2
    `, [project_id, site_id]);

    if (projectCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Project not found', null, 'PROJECT_NOT_FOUND'));
    }

    if (projectCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json(createErrorResponse('Access denied', null, 'ACCESS_DENIED'));
    }

    const image_id = uuidv4();
    const url = `/storage/${req.file.filename}`;

    const result = await pool.query(`
      INSERT INTO image_assets (image_id, site_id, project_id, url, alt_text)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [image_id, site_id, project_id, url, alt_text]);

    // Update project images array
    const current_images = projectCheck.rows[0].images || [];
    const updated_images = [...current_images, url];

    await pool.query(
      'UPDATE portfolio_projects SET images = $1, updated_at = CURRENT_TIMESTAMP WHERE project_id = $2',
      [updated_images, project_id]
    );

    res.status(201).json({
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Upload project image error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// ASSET MANAGEMENT ENDPOINTS

/*
  Create site asset
  Uploads and manages site-level assets
*/
app.post('/api/sites/:site_id/assets', authenticateToken, upload.single('asset'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { site_id } = req.params;
    const { alt_text } = req.body;

    if (!req.file) {
      return res.status(400).json(createErrorResponse('No asset file provided', null, 'NO_ASSET_FILE'));
    }

    // Verify site ownership
    const siteCheck = await pool.query(
      'SELECT user_id FROM portfolio_sites WHERE site_id = $1',
      [site_id]
    );

    if (siteCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Site not found', null, 'SITE_NOT_FOUND'));
    }

    if (siteCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json(createErrorResponse('Access denied', null, 'ACCESS_DENIED'));
    }

    const image_id = uuidv4();
    const url = `/storage/${req.file.filename}`;

    const result = await pool.query(`
      INSERT INTO image_assets (image_id, site_id, url, alt_text)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [image_id, site_id, url, alt_text]);

    res.status(201).json({
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Create site asset error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Update site asset
  Updates asset metadata
*/
app.put('/api/sites/:site_id/assets/:asset_id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { site_id, asset_id } = req.params;
    const { url, alt_text } = req.body;

    // Verify asset exists and user has access
    const assetCheck = await pool.query(`
      SELECT ia.*, ps.user_id 
      FROM image_assets ia 
      JOIN portfolio_sites ps ON ia.site_id = ps.site_id 
      WHERE ia.image_id = $1 AND ia.site_id = $2
    `, [asset_id, site_id]);

    if (assetCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Asset not found', null, 'ASSET_NOT_FOUND'));
    }

    if (assetCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json(createErrorResponse('Access denied', null, 'ACCESS_DENIED'));
    }

    const result = await pool.query(`
      UPDATE image_assets 
      SET url = COALESCE($1, url), alt_text = COALESCE($2, alt_text)
      WHERE image_id = $3
      RETURNING *
    `, [url, alt_text, asset_id]);

    res.json({
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update asset error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Delete site asset
  Removes asset and file
*/
app.delete('/api/sites/:site_id/assets/:asset_id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { site_id, asset_id } = req.params;

    // Verify asset exists and user has access
    const assetCheck = await pool.query(`
      SELECT ia.*, ps.user_id 
      FROM image_assets ia 
      JOIN portfolio_sites ps ON ia.site_id = ps.site_id 
      WHERE ia.image_id = $1 AND ia.site_id = $2
    `, [asset_id, site_id]);

    if (assetCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Asset not found', null, 'ASSET_NOT_FOUND'));
    }

    if (assetCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json(createErrorResponse('Access denied', null, 'ACCESS_DENIED'));
    }

    const asset = assetCheck.rows[0];

    // Delete file from storage
    const file_path = path.join(__dirname, asset.url);
    if (fs.existsSync(file_path)) {
      fs.unlinkSync(file_path);
    }

    // Delete database record
    await pool.query('DELETE FROM image_assets WHERE image_id = $1', [asset_id]);

    res.json({
      data: asset
    });
  } catch (error) {
    console.error('Delete asset error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// CONTACT SUBMISSIONS ENDPOINTS

/*
  Submit contact form
  Handles visitor contact form submissions
*/
app.post('/api/contact/submit', async (req, res) => {
  try {
    const { name, email, message, site_id } = req.body;

    if (!email || !message) {
      return res.status(400).json(createErrorResponse('Email and message are required', null, 'MISSING_REQUIRED_FIELDS'));
    }

    const submission_id = uuidv4();

    const result = await pool.query(`
      INSERT INTO contact_submissions (submission_id, site_id, name, email, message)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [submission_id, site_id || null, name || null, email, message]);

    res.status(201).json({
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Submit contact error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// DASHBOARD ENDPOINTS

/*
  Dashboard: List projects with search and pagination
  Provides dashboard interface for project management
*/
app.get('/api/dashboard/projects', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { site_id, search_query, page = 1, page_size = 10 } = req.query;

    if (!site_id) {
      return res.status(400).json(createErrorResponse('Site ID is required', null, 'MISSING_SITE_ID'));
    }

    // Verify site ownership
    const siteCheck = await pool.query(
      'SELECT user_id FROM portfolio_sites WHERE site_id = $1',
      [site_id]
    );

    if (siteCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Site not found', null, 'SITE_NOT_FOUND'));
    }

    if (siteCheck.rows[0].user_id !== req.user!.id) {
      return res.status(403).json(createErrorResponse('Access denied', null, 'ACCESS_DENIED'));
    }

    let query = 'SELECT * FROM portfolio_projects WHERE site_id = $1';
    let query_params: any[] = [site_id];
    let param_index = 2;

    if (search_query && typeof search_query === 'string') {
      query += ` AND (title ILIKE $${param_index} OR description ILIKE $${param_index})`;
      query_params.push(`%${search_query}%`);
      param_index++;
    }

    query += ' ORDER BY order_index ASC, created_at DESC';

    const pageNum = typeof page === 'string' ? parseInt(page) : Number(page);
    const pageSizeNum = typeof page_size === 'string' ? parseInt(page_size) : Number(page_size);
    const offset = (pageNum - 1) * pageSizeNum;
    query += ` LIMIT $${param_index} OFFSET $${param_index + 1}`;
    query_params.push(pageSizeNum, offset);

    const result = await pool.query(query, query_params);

    // Get total count
    let count_query = 'SELECT COUNT(*) FROM portfolio_projects WHERE site_id = $1';
    let count_params: any[] = [site_id];

    if (search_query && typeof search_query === 'string') {
      count_query += ' AND (title ILIKE $2 OR description ILIKE $2)';
      count_params.push(`%${search_query}%`);
    }

    const count_result = await pool.query(count_query, count_params);

    res.json({
      data: result.rows,
      total: parseInt(count_result.rows[0].count)
    });
  } catch (error) {
    console.error('Dashboard list projects error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Dashboard: List contact submissions
  Provides admin interface for viewing contact form submissions
*/
app.get('/api/dashboard/submissions', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get submissions for all sites owned by the user
    const result = await pool.query(`
      SELECT cs.* 
      FROM contact_submissions cs
      LEFT JOIN portfolio_sites ps ON cs.site_id = ps.site_id
      WHERE ps.user_id = $1 OR cs.site_id IS NULL
      ORDER BY cs.created_at DESC
    `, [req.user!.id]);

    res.json({
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Dashboard list submissions error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Dashboard: Live preview
  Provides preview URL for site preview functionality
*/
app.get('/api/dashboard/preview', (req, res) => {
  // Mock preview functionality
  res.json({
    status: 'ready',
    url: 'https://picsum.photos/id/42/1200/800'
  });
});

/*
  Dashboard: Export status
  Returns current export status and download URLs
*/
app.get('/api/dashboard/export', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  // Mock export status - in production this would check actual export jobs
  res.json({
    export_zip_url: `https://example.com/exports/portfolio-${Date.now()}.zip`,
    export_path: `/storage/portfolio-${Date.now()}.zip`
  });
});

// HELP ENDPOINTS

/*
  Get help documentation
  Returns help content and quick start guides
*/
app.get('/api/help/docs', (req, res) => {
  const help_content = `
# PortfolioPro Quick Start Guide

## Getting Started
1. Create your account and log in
2. Create a new portfolio site
3. Add your hero section with title and background image
4. Write your about section 
5. Add at least 6 projects with images and descriptions
6. Customize your theme and colors
7. Set up SEO metadata
8. Publish your site!

## Key Features
- **Hero Section**: Make a great first impression with a compelling headline and hero image
- **About Section**: Tell your story and showcase your skills
- **Projects**: Display your best work with images, descriptions, and links
- **Theme Customization**: Choose from templates and customize colors/fonts
- **SEO Optimization**: Set meta titles and descriptions for better search visibility
- **Static Export**: Download your portfolio as a standalone website
- **Subdomain Hosting**: Get a free subdomain to share your work

## Tips for Success
- Use high-quality images (recommended: 1200x800px or larger)
- Write compelling project descriptions that tell a story
- Include links to live demos and source code when possible
- Keep your about section concise but personal
- Update your portfolio regularly with new projects

## Technical Requirements
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Image files: JPG, PNG, WebP (max 10MB each)
- Recommended screen resolution: 1920x1080 or higher

## Support
If you need help, contact our support team or check our FAQ section.
  `;

  res.json({
    content: help_content.trim()
  });
});

// STATIC FILE SERVING

// Serve uploaded files from storage
app.use('/storage', express.static(storage_dir));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Catch-all route for SPA routing (avoid hijacking /api routes)
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

export { app, pool };

// Start the server
const portNum = typeof PORT === 'string' ? parseInt(PORT) : PORT;
app.listen(portNum, '0.0.0.0', () => {
  console.log(`PortfolioPro API server running on port ${portNum} and listening on 0.0.0.0`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Storage directory: ${storage_dir}`);
});