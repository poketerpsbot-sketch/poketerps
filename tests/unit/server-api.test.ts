import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nextRequest = vi.hoisted(() => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("next/headers", () => nextRequest);

import { serverApi, unwrapList, unwrapObject } from "@/components/data/server-api";

beforeEach(() => {
  vi.restoreAllMocks();
  nextRequest.cookies.mockReset();
  nextRequest.headers.mockReset();
  nextRequest.cookies.mockResolvedValue({ toString: () => "session=test-session" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("serverApi request origin", () => {
  it("uses the configured origin when forwarded headers match it", async () => {
    nextRequest.headers.mockResolvedValue(
      new Headers({
        host: "internal-render-host:10000",
        "x-forwarded-host": "pokedex.example.test",
        "x-forwarded-proto": "https",
      }),
    );
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ data: { latest: [] } }, { status: 200 }));

    const result = await serverApi<unknown>("/api/home");

    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://pokedex.example.test/api/home"),
      expect.objectContaining({
        cache: "no-store",
        headers: expect.objectContaining({ cookie: "session=test-session" }),
      }),
    );
    expect(result.status).toBe(200);
    expect(result.error).toBeNull();
  });

  it("never forwards session cookies to a hostile forwarded host", async () => {
    nextRequest.headers.mockResolvedValue(
      new Headers({
        host: "internal-render-host:10000",
        "x-forwarded-host": "attacker.example",
        "x-forwarded-proto": "https",
      }),
    );
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ data: [] }, { status: 200 }));

    await serverApi<unknown>("/api/categories");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://pokedex.example.test/api/categories"),
      expect.objectContaining({
        headers: expect.objectContaining({ cookie: "session=test-session" }),
      }),
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain("attacker.example");
  });

  it("falls back to NEXT_PUBLIC_APP_URL when there is no request host", async () => {
    nextRequest.headers.mockResolvedValue(new Headers());
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ data: [] }, { status: 200 }));

    await serverApi<unknown>("api/categories");

    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://pokedex.example.test/api/categories"),
      expect.any(Object),
    );
  });

  it("permits an explicit loopback request origin only in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    nextRequest.headers.mockResolvedValue(new Headers({ host: "127.0.0.1:3100" }));
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ data: [] }, { status: 200 }));

    await serverApi<unknown>("/api/catalogue");

    expect(fetchMock).toHaveBeenCalledWith(
      new URL("http://127.0.0.1:3100/api/catalogue"),
      expect.any(Object),
    );
  });
});

describe("public API envelope readers", () => {
  it("reads object and list DTOs from the shared data envelope", () => {
    expect(unwrapObject<{ latest: unknown[] }>({ data: { latest: [] } })).toEqual({ latest: [] });
    expect(unwrapList<{ id: string }>({ data: [{ id: "entry-1" }] })).toEqual([{ id: "entry-1" }]);
  });
});
