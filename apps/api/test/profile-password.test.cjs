const { test } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const {
  AuthService,
  AuthController,
  SessionGuard,
} = require("../dist/auth/auth");

test("password change rejects an incorrect current password without saving", async () => {
  let saves = 0;
  const service = new AuthService({ save: async () => saves++ }, {});
  const user = {
    id: "user-1",
    passwordHash: await bcrypt.hash("original-password", 4),
  };
  const originalHash = user.passwordHash;
  await assert.rejects(
    service.changePassword(user, {
      currentPassword: "wrong-password",
      newPassword: "replacement-password",
    }),
    (error) => error.getStatus() === 403,
  );
  assert.equal(saves, 0);
  assert.equal(user.passwordHash, originalHash);
});

test("password change saves a hash for the authenticated user", async () => {
  let saved;
  const service = new AuthService(
    {
      save: async (value) => {
        saved = value;
      },
    },
    {},
  );
  const user = {
    id: "user-1",
    passwordHash: await bcrypt.hash("original-password", 4),
  };
  const result = await service.changePassword(user, {
    currentPassword: "original-password",
    newPassword: "replacement-password",
  });
  assert.equal(saved.id, "user-1");
  assert.notEqual(saved.passwordHash, "replacement-password");
  assert.equal(
    await bcrypt.compare("replacement-password", saved.passwordHash),
    true,
  );
  assert.equal(
    await bcrypt.compare("original-password", saved.passwordHash),
    false,
  );
  assert.deepEqual(result, { success: true });
});

test("password endpoint requires an authenticated session", () => {
  const guards = Reflect.getMetadata(
    "__guards__",
    AuthController.prototype.password,
  );
  assert.ok(guards.includes(SessionGuard));
});

test("user update validates role group and does not reset omitted role", async () => {
  const { UpdateUserInput } = require("../dist/auth/auth");
  const { validate } = require("class-validator");
  const { plainToInstance } = require("class-transformer");
  const { randomUUID } = require("node:crypto");
  const update = plainToInstance(UpdateUserInput, {
    roleGroupId: randomUUID(),
  });
  assert.deepEqual(await validate(update), []);
  assert.equal(update.role, undefined);
  assert.deepEqual(
    await validate(plainToInstance(UpdateUserInput, { roleGroupId: null })),
    [],
  );
  assert.ok(
    (
      await validate(
        plainToInstance(UpdateUserInput, {
          roleGroupId: "invalid",
          role: "owner",
        }),
      )
    ).length >= 2,
  );
  let saved;
  const service = new AuthService(
    {
      findOneByOrFail: async () => ({ id: "user", role: "operator" }),
      save: async (user) => {
        saved = user;
        return user;
      },
    },
    {},
  );
  await service.update("user", update);
  assert.equal(saved.roleGroupId, update.roleGroupId);
  assert.equal(saved.role, "operator");
  await service.update("user", { roleGroupId: null });
  assert.equal(saved.roleGroupId, null);
});
