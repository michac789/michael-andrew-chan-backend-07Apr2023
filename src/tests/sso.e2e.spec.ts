import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { ModelService } from '../model/model.service';
import * as argon from 'argon2';
import * as request from 'supertest';

describe('App SSO e2e', () => {
  let app: INestApplication;
  let model: ModelService;

  beforeAll(async () => {
    // model = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
      }),
    );
    await app.init();
    await app.listen(3334);

    // make sure database is initially empty
    model = app.get(ModelService);
    await model.cleanDb();
  });

  afterAll(async () => await model.cleanDb());

  describe('sso', () => {
    describe('register', () => {
      const registerEndpoint = '/sso/register/';

      it('[POST] Return 400 if name is empty string', async () => {
        const sendData = {
          name: '',
          password: '123',
          email: 'mich0107@e.ntu.edu.sg',
        };
        const response = await request(app.getHttpServer())
          .post(registerEndpoint)
          .send(sendData);
        expect(response.status).toBe(400);
      });

      it('[POST] Return 400 if name is not given', async () => {
        const sendData = {
          password: '123',
          email: 'mich0107@e.ntu.edu.sg',
        };
        const response = await request(app.getHttpServer())
          .post(registerEndpoint)
          .send(sendData);
        expect(response.status).toBe(400);
      });

      it('[POST] Return 400 if password is empty string', async () => {
        const sendData = {
          name: 'michael',
          password: '',
        };
        const response = await request(app.getHttpServer())
          .post(registerEndpoint)
          .send(sendData);
        expect(response.status).toBe(400);
      });

      it('[POST] Return 400 if password is not given', async () => {
        const sendData = {
          name: 'michael',
        };
        const response = await request(app.getHttpServer())
          .post(registerEndpoint)
          .send(sendData);
        expect(response.status).toBe(400);
      });

      it('[POST] Return 400 if email is given but not an email', async () => {
        const sendData = {
          name: 'michael',
          password: '123',
          email: 'mich0107',
        };
        const response = await request(app.getHttpServer())
          .post(registerEndpoint)
          .send(sendData);
        expect(response.status).toBe(400);
      });

      it('[POST] Return 409 if duplicate name given', async () => {
        await model.user.create({
          data: {
            cashBalance: 0,
            name: 'michael',
            password: await argon.hash('123'),
          },
        });
        const sendData = {
          name: 'michael',
          password: '123',
          email: 'mich0107@e.ntu.edu.sg',
        };
        const response = await request(app.getHttpServer())
          .post(registerEndpoint)
          .send(sendData);
        expect(response.status).toBe(409);
      });

      it('[POST] Return 201 if created, cashBalance initialized to zero, save hashed password, return access token', async () => {
        const sendData = {
          name: 'michael andrew chan 9',
          password: '123',
          email: 'mich0107@e.ntu.edu.sg',
        };
        const response = await request(app.getHttpServer())
          .post(registerEndpoint)
          .send(sendData);
        expect(response.status).toBe(201);
        // should return access token and be logged in directly
        expect(response.body).toHaveProperty('accessToken');
        // verify that the instance is indeed created in the database
        const createdUser = await model.user.findUnique({
          where: { name: sendData.name },
        });
        expect(createdUser.name).toBe('michael andrew chan 9');
        expect(createdUser.cashBalance.toString()).toBe('0');
        expect(createdUser.email).toBe('mich0107@e.ntu.edu.sg');
        // verify that it store hashed password and not raw pw
        // we cannot verify same when hashing due to random salt given
        expect(createdUser.password).not.toBe('123');
        expect(createdUser.password.length).toBeGreaterThan(20);
      });
    });

    describe('login', () => {
      const loginEndpoint = '/sso/login/';

      it('[POST] Return 400 if name is empty string', async () => {
        const sendData = {
          name: '',
          password: '123',
        };
        const response = await request(app.getHttpServer())
          .post(loginEndpoint)
          .send(sendData);
        expect(response.status).toBe(400);
      });

      it('[POST] Return 400 if name is not given', async () => {
        const sendData = {
          password: '123',
          email: 'mich0107@e.ntu.edu.sg',
        };
        const response = await request(app.getHttpServer())
          .post(loginEndpoint)
          .send(sendData);
        expect(response.status).toBe(400);
      });

      it('[POST] Return 400 if password is empty string', async () => {
        const sendData = {
          name: 'michael',
          password: '',
        };
        const response = await request(app.getHttpServer())
          .post(loginEndpoint)
          .send(sendData);
        expect(response.status).toBe(400);
      });

      it('[POST] Return 400 if password is not given', async () => {
        const sendData = {
          name: 'michael',
        };
        const response = await request(app.getHttpServer())
          .post(loginEndpoint)
          .send(sendData);
        expect(response.status).toBe(400);
      });

      it('[POST] Return 400 if email is given but not an email', async () => {
        const sendData = {
          name: 'michael',
          password: '123',
          email: 'mich0107',
        };
        const response = await request(app.getHttpServer())
          .post(loginEndpoint)
          .send(sendData);
        expect(response.status).toBe(400);
      });

      it('[POST] Return 401 if name is invalid', async () => {
        const sendData = {
          name: 'asfihjafshf',
          password: '123',
        };
        const response = await request(app.getHttpServer())
          .post(loginEndpoint)
          .send(sendData);
        expect(response.status).toBe(401);
      });

      it('[POST] Return 401 if password does not match', async () => {
        const sendData = {
          name: 'michael',
          password: '1234',
        };
        const response = await request(app.getHttpServer())
          .post(loginEndpoint)
          .send(sendData);
        expect(response.status).toBe(401);
      });

      it('[POST] Return 200 and get access code when success', async () => {
        const sendData = {
          name: 'michael',
          password: '123',
        };
        const response = await request(app.getHttpServer())
          .post(loginEndpoint)
          .send(sendData);
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('accessToken');
      });
    });

    describe('user', () => {
      const userEndpoint = '/sso/user/';
      const loginEndpoint = '/sso/login/';
      let accessToken: string;

      it('[GET] Return 401 if not logged in (no bearer token)', async () => {
        const response = await request(app.getHttpServer()).get(userEndpoint);
        expect(response.status).toBe(401);
      });

      it('[GET] Return 401 if wrong bearer token (or expired)', async () => {
        const wrongToken = '12345'; // arbitary wrong token
        const response = await request(app.getHttpServer())
          .get(userEndpoint)
          .set('Authorization', `Bearer ${wrongToken}`);
        expect(response.status).toBe(401);
      });

      it('[GET] Return 200 if success, with profile information', async () => {
        const sendData = {
          name: 'michael',
          password: '123',
        };
        const responseToken = await request(app.getHttpServer())
          .post(loginEndpoint)
          .send(sendData);
        accessToken = responseToken.body.accessToken;
        const response = await request(app.getHttpServer())
          .get(userEndpoint)
          .set('Authorization', `Bearer ${accessToken}`);
        expect(response.status).toBe(200);
        expect(response.body.cashBalance.toString()).toBe('0');
        expect(response.body.name).toBe('michael');
        expect(response.body.email).toBe(null);
      });

      it('[PUT] Return 401 if not logged in (no bearer token)', async () => {
        const sendData = {
          name: 'michael',
          password: '123',
          newPassword: '12345',
        };
        const response = await request(app.getHttpServer())
          .put(userEndpoint)
          .send(sendData);
        expect(response.status).toBe(401);
      });

      it('[PUT] Return 401 if wrong original password entered', async () => {
        const sendData = {
          name: 'michael',
          password: 'asfsdfa', // wrong original password
          newPassword: '12345',
        };
        const response = await request(app.getHttpServer())
          .put(userEndpoint)
          .send(sendData)
          .set('Authorization', `Bearer ${accessToken}`);
        expect(response.status).toBe(401);
      });

      it('[PUT] Return 400 if name is missing or empty string', async () => {
        const sendData = {
          name: '',
          password: '123',
          newPassword: '12345',
        };
        const response = await request(app.getHttpServer())
          .put(userEndpoint)
          .send(sendData)
          .set('Authorization', `Bearer ${accessToken}`);
        expect(response.status).toBe(400);
      });

      it('[PUT] Return 400 if password (original) is missing or empty string', async () => {
        const sendData = {
          name: 'michael',
          newPassword: '123',
        };
        const response = await request(app.getHttpServer())
          .put(userEndpoint)
          .send(sendData)
          .set('Authorization', `Bearer ${accessToken}`);
        expect(response.status).toBe(400);
      });

      it('[PUT] Return 200 if change password success', async () => {
        const sendData = {
          name: 'michael',
          password: '123',
          newPassword: '12345',
        };
        const response = await request(app.getHttpServer())
          .put(userEndpoint)
          .send(sendData)
          .set('Authorization', `Bearer ${accessToken}`);
        expect(response.status).toBe(200);
        const user = await model.user.findUnique({
          where: { name: 'michael' },
        });
        // check that the password stores is already hashed
        expect(user.password).not.toBe('12345');
        expect(user.password.length).toBeGreaterThan(20);
      });

      it('[PUT] Return 200 if change email success, check database change', async () => {
        const sendData = {
          name: 'michael',
          password: '12345',
          email: 'mich0107@e.ntu.edu.sg',
        };
        const response = await request(app.getHttpServer())
          .put(userEndpoint)
          .send(sendData)
          .set('Authorization', `Bearer ${accessToken}`);
        expect(response.status).toBe(200);
        const user = await model.user.findUnique({
          where: { name: 'michael' },
        });
        expect(user.email).toBe('mich0107@e.ntu.edu.sg');
      });

      it('[DELETE] Return 401 if not logged in (no bearer token)', async () => {
        const sendData = {
          name: 'michael',
          password: '12345',
        };
        const response = await request(app.getHttpServer())
          .delete(userEndpoint)
          .send(sendData);
        expect(response.status).toBe(401);
      });

      it('[DELETE] Return 401 if wrong password', async () => {
        const sendDataCredentials = {
          name: 'michael',
          password: '12345',
        };
        const responseToken = await request(app.getHttpServer())
          .post(loginEndpoint)
          .send(sendDataCredentials);
        const accessToken = responseToken.body.accessToken;
        const sendData = {
          name: 'michael',
          password: '123', // was already changed to 12345
        };
        const response = await request(app.getHttpServer())
          .delete(userEndpoint)
          .send(sendData)
          .set('Authorization', `Bearer ${accessToken}`);
        expect(response.status).toBe(401);
      });

      it('[DELETE] Return 400 if name is missing or empty string', async () => {
        const sendData = {
          password: '12345',
        };
        const response = await request(app.getHttpServer())
          .delete(userEndpoint)
          .send(sendData)
          .set('Authorization', `Bearer ${accessToken}`);
        expect(response.status).toBe(400);
      });

      it('[DELETE] Return 400 if password is missing or empty string', async () => {
        const sendData = {
          name: 'michael',
        };
        const response = await request(app.getHttpServer())
          .delete(userEndpoint)
          .send(sendData)
          .set('Authorization', `Bearer ${accessToken}`);
        expect(response.status).toBe(400);
      });

      it('[DELETE] Return 204 and delete this user when success', async () => {
        // user exist initially
        const createdUser1 = await model.user.findUnique({
          where: { name: 'michael' },
        });
        expect(createdUser1).toBeDefined();
        // perform valid deletion request
        const sendData = {
          name: 'michael',
          password: '12345',
        };
        const response = await request(app.getHttpServer())
          .delete(userEndpoint)
          .send(sendData)
          .set('Authorization', `Bearer ${accessToken}`);
        expect(response.status).toBe(204);
        // user does not exist anymore
        const createdUser2 = await model.user.findUnique({
          where: { name: 'michael' },
        });
        expect(createdUser2).toBeNull();
      });
    });

    describe('user/topup', () => {
      const topupEndpoint = '/sso/user/topup/';
      const loginEndpoint = '/sso/login/';
      let accessToken: string;

      it('[POST] Return 401 if not logged in (no bearer token)', async () => {
        await model.user.create({
          data: {
            cashBalance: 1.02,
            name: 'michael',
            password: await argon.hash('123'),
          },
        });
        const response = await request(app.getHttpServer()).post(topupEndpoint);
        expect(response.status).toBe(401);
      });

      it('[POST] Return 400 if no additionalCashBalance body', async () => {
        const sendDataCredentials = {
          name: 'michael',
          password: '123',
        };
        const responseToken = await request(app.getHttpServer())
          .post(loginEndpoint)
          .send(sendDataCredentials);
        accessToken = responseToken.body.accessToken;
        const sendData = {};
        const response = await request(app.getHttpServer())
          .post(topupEndpoint)
          .send(sendData)
          .set('Authorization', `Bearer ${accessToken}`);
        expect(response.status).toBe(400);
      });

      it('[POST] Return 400 if additionalCashBalance is not a number', async () => {
        const sendData = { additionalCashBalance: 'abcde' };
        const response = await request(app.getHttpServer())
          .post(topupEndpoint)
          .send(sendData)
          .set('Authorization', `Bearer ${accessToken}`);
        expect(response.status).toBe(400);
      });

      it('[POST] Return 400 if additionalCashBalance is negative values', async () => {
        const sendData = { additionalCashBalance: '-12' };
        const response = await request(app.getHttpServer())
          .post(topupEndpoint)
          .send(sendData)
          .set('Authorization', `Bearer ${accessToken}`);
        expect(response.status).toBe(400);
      });

      it('[POST] Return 200 if valid, make sure the cashBalance increases appropriately', async () => {
        const sendData = { additionalCashBalance: 5.65 };
        const response = await request(app.getHttpServer())
          .post(topupEndpoint)
          .send(sendData)
          .set('Authorization', `Bearer ${accessToken}`);
        expect(response.status).toBe(200);
        // assert that cashBalance increases by correct amount
        const user = await model.user.findUnique({
          where: { name: 'michael' },
        });
        expect(user.cashBalance.toString()).toBe('6.67');
      });
    });
  });
});
