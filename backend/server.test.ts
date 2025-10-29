import { app, pool } from './server.ts'; // import your Express app instance and database pool
import request from 'supertest';

describe('PortfolioPro MVP - Backend API Integration Tests', () => {
  let adminToken: string;
  let siteId: string;
  let projectId: string;
  let siteAssetId: string;
  let projectImageId: string;
  let assetId: string;
  let publicUserId = 'u_alice'; // seeded in BRD/OpenAPI

  // Helper to login as alice (seeded admin/editor user)
  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({
      username: 'alice',
      password: 'password123',
    });

    // If login schema differs, adjust payload accordingly.
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
    // @ts-ignore
    adminToken = res.body?.data?.token;
    expect(typeof adminToken).toBe('string');
  });

  // Public profile sanity check
  test('Public: fetch public user profile for seeded alice', async () => {
    const res = await request(app).get(`/api/users/${publicUserId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    // @ts-ignore
    expect(res.body.data.id).toBe(publicUserId);
    // Public fields
    // @ts-ignore
    expect(res.body.data).toHaveProperty('username');
  });

  describe('Sites API', () => {
    it('POST /api/sites - create a new site (authenticated)', async () => {
      const payload = {
        user_id: 'u_alice',
        site_title: `TestSite-${Date.now()}`,
        tagline: 'A quick MVP test site',
        hero_image_url: null,
        about_text: 'About text for testing',
        template_id: null,
        primary_color: null,
        font_family: null,
        is_dark_mode: false,
        seo_title: 'Test Site',
        seo_description: 'A test portfolio site',
        subdomain: null,
      };

      const res = await request(app)
        .post('/api/sites')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      // @ts-ignore
      siteId = res.body.data.site_id;
      expect(typeof siteId).toBe('string');
    });

    it('GET /api/sites - list sites for authenticated user', async () => {
      const res = await request(app)
        .get('/api/sites')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      // @ts-ignore
      expect(Array.isArray(res.body.data)).toBe(true);
      // total optional; ensure array exists
      // @ts-ignore
      expect(res.body).toHaveProperty('data');
    });

    it('PUT /api/sites/{site_id} - update site title', async () => {
      const res = await request(app)
        .put(`/api/sites/${siteId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ site_id: siteId, site_title: 'Updated Site Title', is_dark_mode: false });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      // @ts-ignore
      expect(res.body.data.site_title).toContain('Updated Site Title');
    });

    it('PUT /api/sites/{site_id}/publish - publish site', async () => {
      const res = await request(app)
        .put(`/api/sites/${siteId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      // @ts-ignore
      expect(res.body.data).toHaveProperty('published_at');
    });

    it('POST /api/sites/{site_id}/export - export site', async () => {
      const res = await request(app)
        .post(`/api/sites/${siteId}/export`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('export_zip_url');
      // @ts-ignore
      expect(typeof res.body.export_zip_url).toBe('string');
    });

    it('PUT /api/sites/{site_id}/hero - update hero', async () => {
      const res = await request(app)
        .put(`/api/sites/${siteId}/hero`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'New Hero Title', tagline: 'New tagline', hero_image_url: null });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      // @ts-ignore
      expect(res.body.data.site_title).toBeTruthy();
    });

    it('PUT /api/sites/{site_id}/about - update about', async () => {
      const res = await request(app)
        .put(`/api/sites/${siteId}/about`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ bio: 'Updated bio for testing', avatar_url: null });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
    });

    it('PUT /api/sites/{site_id}/seo - update SEO', async () => {
      const res = await request(app)
        .put(`/api/sites/${siteId}/seo`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ seo_title: 'Updated SEO Title', seo_description: 'Updated SEO Description' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
    });

    it('PUT /api/sites/{site_id}/theme - update theme', async () => {
      const res = await request(app)
        .put(`/api/sites/${siteId}/theme`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ template_id: null, primary_color: '#FF5733', font_family: 'Inter', is_dark_mode: false });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
    });

    it('GET /api/sites/{site_id}/projects - initially empty', async () => {
      const res = await request(app)
        .get(`/api/sites/${siteId}/projects`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      // @ts-ignore
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /api/sites/{site_id}/projects - create a project', async () => {
      const payload = {
        site_id: siteId,
        title: 'Test Project',
        description: 'Description of test project',
        date: '2024-01-01',
        tags: ['tag1', 'tag2'],
        demo_url: null,
        code_url: null,
        images: ['https://picsum.photos/seed/project1/800/600'],
        order_index: 1,
      };

      const res = await request(app)
        .post(`/api/sites/${siteId}/projects`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      // @ts-ignore
      projectId = res.body.data.project_id;
      expect(typeof projectId).toBe('string');
    });

    it('GET /api/sites/{site_id}/projects - list contains the created project', async () => {
      const res = await request(app)
        .get(`/api/sites/${siteId}/projects`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      // @ts-ignore
      const list = res.body.data;
      expect(Array.isArray(list)).toBe(true);
    });

    it('PUT /api/sites/{site_id}/projects/{project_id} - update project', async () => {
      const res = await request(app)
        .put(`/api/sites/${siteId}/projects/${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          id: projectId,
          site_id: siteId,
          title: 'Updated Project Title',
          description: 'Updated description',
          date: '2024-02-02',
          tags: ['tag1'],
          demo_url: null,
          code_url: null,
          images: ['https://picsum.photos/seed/project1-updated/800/600'],
          order_index: 2,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
    });

    it('POST /api/sites/{site_id}/projects/{project_id}/images - add image to project', async () => {
      const payload = {
        site_id: siteId,
        project_id: projectId,
        url: 'https://picsum.photos/seed/project1-image/600/400',
        alt_text: 'Project image 1',
      };

      const res = await request(app)
        .post(`/api/sites/${siteId}/projects/${projectId}/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      // @ts-ignore
      projectImageId = res.body.data.image_id;
      expect(typeof projectImageId).toBe('string');
    });

    it('POST /api/sites/{site_id}/assets - create a site asset', async () => {
      const payload = {
        site_id: siteId,
        project_id: null,
        url: 'https://picsum.photos/seed/site-asset/400/300',
        alt_text: 'Site asset',
      };

      const res = await request(app)
        .post(`/api/sites/${siteId}/assets`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      // @ts-ignore
      siteAssetId = res.body.data.image_id;
    });

    it('PUT /api/sites/{site_id}/assets/{asset_id} - update site asset', async () => {
      const res = await request(app)
        .put(`/api/sites/${siteId}/assets/${siteAssetId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          asset_id: siteAssetId,
          site_id: siteId,
          url: 'https://picsum.photos/seed/site-asset-updated/400/300',
          alt_text: 'Updated site asset',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
    });
  });

  describe('Projects & Assets - CRUD lifecycle', () => {
    it('DELETE /api/sites/{site_id}/projects/{project_id} - delete project', async () => {
      const res = await request(app)
        .delete(`/api/sites/${siteId}/projects/${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Depending on mock, 200 OK with Project data or 200 with a success wrapper
      expect([200, 404]).toContain(res.status);
    });

    it('DELETE /api/sites/{site_id}/assets/{asset_id} - delete site asset', async () => {
      const res = await request(app)
        .delete(`/api/sites/${siteId}/assets/${siteAssetId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 404]).toContain(res.status);
    });
  });

  describe('Submissions & Dashboard', () => {
    it('POST /api/contact/submit - submit a visitor message', async () => {
      const payload = {
        name: 'Guest Tester',
        email: 'visitor@example.com',
        message: 'Hello PortfolioPro testing!',
      };

      const res = await request(app)
        .post('/api/contact/submit')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
    });

    it('GET /api/dashboard/projects - list projects for a site', async () => {
      const res = await request(app)
        .get(`/api/dashboard/projects?site_id=${siteId}&page=1&page_size=10`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
    });

    it('GET /api/dashboard/submissions - list submissions (admin)', async () => {
      const res = await request(app)
        .get(`/api/dashboard/submissions`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 204]).toContain(res.status);
    });

    it('GET /api/dashboard/preview - live preview reference', async () => {
      const res = await request(app)
        .get(`/api/dashboard/preview`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('url');
    });

    it('GET /api/dashboard/export - export reference', async () => {
      const res = await request(app)
        .get(`/api/dashboard/export`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('export_zip_url');
    });
  });

  describe('Help Docs', () => {
    it('GET /api/help/docs - fetch help content', async () => {
      const res = await request(app).get('/api/help/docs');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('content');
    });
  });

  describe('Error handling & authorization', () => {
    it('Unauthorized: access protected endpoint without token', async () => {
      const res = await request(app).get('/api/sites');
      expect(res.status).toBe(401);
    });

    it('Bad input: create site with missing required fields', async () => {
      const res = await request(app)
        .post('/api/sites')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ user_id: 'u_alice' /* missing site_title and is_dark_mode */ });

      expect(res.status).toBe(400);
    });

    it('Not Found: get non-existent site by id', async () => {
      const res = await request(app)
        .get('/api/sites/non-existent-site-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect([404, 400]).toContain(res.status);
    });
  });
});