BEGIN;

-- Core schema
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(100),
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  category_id TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  user_id TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Performance-friendly indexes
CREATE INDEX IF NOT EXISTS idx_posts_published ON posts (published);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments (post_id);

-- Seed data (plaintext passwords as requested for development/testing)
INSERT INTO users (id, username, email, password_hash, full_name, avatar_url, is_active)
VALUES
  ('u_alice','alice','alice@example.com','password123','Alice Smith','https://picsum.photos/seed/alice/200/200', TRUE),
  ('u_bob','bob','bob@example.com','password123','Bob Johnson','https://picsum.photos/seed/bob/200/200', TRUE),
  ('u_charlie','charlie','charlie@example.com','admin123','Charlie Lee','https://picsum.photos/seed/charlie/200/200', TRUE),
  ('u_diane','diane','diane@example.com','user123','Diane Green','https://picsum.photos/seed/diane/200/200', TRUE),
  ('u_erin','erin','erin@example.com','user123','Erin Black','https://picsum.photos/seed/erin/200/200', TRUE),
  ('u_frank','frank','frank@example.com','guest123','Frank White','https://picsum.photos/seed/frank/200/200', TRUE);

INSERT INTO roles (id, name) VALUES
  ('r_admin','admin'),
  ('r_editor','editor'),
  ('r_user','user');

INSERT INTO user_roles (user_id, role_id) VALUES
  ('u_alice','r_admin'),
  ('u_alice','r_editor'),
  ('u_bob','r_user'),
  ('u_charlie','r_editor'),
  ('u_diane','r_user'),
  ('u_erin','r_user'),
  ('u_frank','r_user');

INSERT INTO categories (id, name, description) VALUES
  ('c_news','News','Latest news and updates'),
  ('c_tech','Tech','Tech tutorials and insights'),
  ('c_lifestyle','Lifestyle','Tips and lifestyle articles'),
  ('c_tutorials','Tutorials','Step-by-step guides');

INSERT INTO posts (id, user_id, category_id, title, content, image_url, published)
VALUES
  ('p1','u_alice','c_news','Welcome to our new platform','We are excited to launch our new blog and share updates with the community.','https://picsum.photos/seed/welcome/1200/600', TRUE),
  ('p2','u_charlie','c_tech','Demystifying PostgreSQL performance','In this article we explore performance considerations for PostgreSQL','https://picsum.photos/seed/post2/1200/600', TRUE),
  ('p3','u_bob','c_lifestyle','Healthy coding habits','Tips to maintain focus while coding','https://picsum.photos/seed/lifestyle/1200/600', FALSE),
  ('p4','u_diane','c_tutorials','Building an API with Node.js and PostgreSQL','A step-by-step guide to building a robust API','https://picsum.photos/seed/node-postgres/1200/600', TRUE);

INSERT INTO comments (id, post_id, user_id, content) VALUES
  ('cm1','p1','u_bob','Congrats on the launch!'),
  ('cm2','p1','u_charlie','Looking forward to more updates'),
  ('cm3','p4','u_erin','Thanks for the guide!');

COMMIT;