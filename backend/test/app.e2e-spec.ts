import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { setupApp } from './../src/setup-app';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  const buildFetchResponse = (statusCode: number): Response => {
    return new Response(
      JSON.stringify({ ok: statusCode >= 200 && statusCode < 300 }),
      {
        status: statusCode,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(buildFetchResponse(200));
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer()).get('/health').expect(200);
  });

  it('/health/devices (GET)', () => {
    return request(app.getHttpServer())
      .get('/health/devices')
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          status: string;
          totalDevices: number;
          onlineDevices: number;
          offlineDevices: number;
          checkedAt: string;
        };

        expect(body.status).toBe('ok');
        expect(typeof body.totalDevices).toBe('number');
        expect(typeof body.onlineDevices).toBe('number');
        expect(typeof body.offlineDevices).toBe('number');
        expect(typeof body.checkedAt).toBe('string');
      });
  });

  it('/devices (POST + GET)', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/devices')
      .send({
        name: 'Riego Patio',
        description: 'Nodo de riego principal',
        ipAddress: '192.168.1.90',
        port: 80,
      });

    expect(createResponse.status).toBe(201);

    const createdDevice = createResponse.body as {
      id: string;
      name: string;
      status: string;
    };
    expect(createdDevice.id).toBeDefined();
    expect(createdDevice.name).toBe('Riego Patio');
    expect(createdDevice.status).toBe('offline');

    const listResponse = await request(app.getHttpServer())
      .get('/devices')
      .expect(200);
    const devices = listResponse.body as Array<{ id: string }>;

    expect(devices.length).toBeGreaterThan(0);
    expect(devices.some((device) => device.id === createdDevice.id)).toBe(true);
  });

  it('/devices (POST invalid payload)', () => {
    return request(app.getHttpServer())
      .post('/devices')
      .send({
        name: '',
        description: 'x',
        ipAddress: 'invalid-ip',
        port: 0,
      })
      .expect(400)
      .expect((response) => {
        const body = response.body as {
          statusCode: number;
          path: string;
          message: string[];
        };

        expect(body.statusCode).toBe(400);
        expect(body.path).toBe('/devices');
        expect(Array.isArray(body.message)).toBe(true);
      });
  });

  it('/devices/:id/actions (POST success)', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/devices')
      .send({
        name: 'Luces Terraza',
        description: 'Nodo de luces terraza',
        ipAddress: '192.168.1.91',
        port: 80,
      });

    const createdDevice = createResponse.body as { id: string };

    const actionResponse = await request(app.getHttpServer())
      .post(`/devices/${createdDevice.id}/actions`)
      .send({
        action: 'turn_on',
        target: 'luces',
      })
      .expect(201);

    const body = actionResponse.body as {
      result: string;
      endpoint: string;
      httpStatusCode: number;
    };

    expect(body.result).toBe('success');
    expect(body.endpoint).toBe('/luces/on');
    expect(body.httpStatusCode).toBe(200);
  });

  it('/devices/:id/actions (POST unreachable device -> 502)', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Connection timeout'));

    const createResponse = await request(app.getHttpServer())
      .post('/devices')
      .send({
        name: 'Bomba Jardin',
        description: 'Nodo de bomba',
        ipAddress: '192.168.1.92',
        port: 80,
      });

    const createdDevice = createResponse.body as { id: string };

    await request(app.getHttpServer())
      .post(`/devices/${createdDevice.id}/actions`)
      .send({
        action: 'turn_off',
        target: 'riego',
      })
      .expect(502)
      .expect((response) => {
        const body = response.body as {
          statusCode: number;
          path: string;
        };

        expect(body.statusCode).toBe(502);
        expect(body.path).toBe(`/devices/${createdDevice.id}/actions`);
      });
  });

  afterEach(async () => {
    fetchSpy.mockRestore();
    await app.close();
  });
});
