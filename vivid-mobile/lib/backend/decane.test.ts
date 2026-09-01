import { verifyEmailCode } from "./decane";

describe("verifyEmailCode", () => {
  const originalFetch = globalThis.fetch;

  function answerWith(body: unknown, ok = true) {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 400,
      json: async () => body,
    }) as unknown as typeof fetch;
  }

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("falls back to the address the code was sent to", async () => {
    // Decane does not echo the address back, and it is the one thing we know
    // for certain: the code only reaches the inbox that owns it.
    answerWith({ jwt: "abc.def.ghi", profile: { name: "Ada Lovelace" } });

    await expect(verifyEmailCode("ada@example.com", "123456")).resolves.toEqual({
      jwt: "abc.def.ghi",
      profile: { name: "Ada Lovelace", email: "ada@example.com", picture: null },
    });
  });

  it("prefers the address Decane reports when it sends one", async () => {
    answerWith({ jwt: "abc.def.ghi", profile: { email: "ada@work.example" } });

    const result = await verifyEmailCode("ada@example.com", "123456");
    expect(result.profile.email).toBe("ada@work.example");
  });

  it("rejects a response with no token", async () => {
    answerWith({ isNewUser: true });

    await expect(verifyEmailCode("ada@example.com", "000000")).rejects.toThrow(
      "That code did not work. Ask for a new one."
    );
  });
});
