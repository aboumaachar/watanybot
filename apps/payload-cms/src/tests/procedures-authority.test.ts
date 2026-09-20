import { describe, expect, it } from "vitest";
import { Procedures } from "../collections/Procedures";

type Principal = { capabilitySnapshot: unknown };
type Document = { _status?: "draft" | "published"; procedureCode: string };

const access = Procedures.access as {
  read: (args: { req: { user?: unknown } }) => boolean;
  create: (args: { req: { user?: unknown } }) => boolean;
  update: (args: { req: { user?: unknown } }) => boolean;
};
const beforeChange = Procedures.hooks?.beforeChange?.[0] as (args: {
  data?: Record<string, unknown>;
  originalDoc?: Record<string, unknown>;
  req: { user?: unknown };
}) => Promise<Record<string, unknown> | undefined>;

const principal = (...capabilities: string[]): Principal => ({ capabilitySnapshot: capabilities });
const request = (user?: unknown) => ({ user });
const document = (status: "draft" | "published"): Document => ({ _status: status, procedureCode: "proc-authority" });
const expectPublicationAllowed = async (user: unknown, data: Document, originalDoc: Document) => {
  await expect(beforeChange({ data, originalDoc, req: request(user) })).resolves.toBeUndefined();
};
const expectPublicationDenied = async (user: unknown, data: Document, originalDoc: Document) => {
  await expect(beforeChange({ data, originalDoc, req: request(user) })).rejects.toThrow("CMS_PUBLISH_CAPABILITY_REQUIRED");
};

const draft = document("draft");
const published = document("published");

describe("Procedures authority and publication matrix", () => {
  it("allows cms.create to create drafts and denies direct published create without publish", async () => {
    expect(access.create({ req: request(principal("cms.create")) })).toBe(true);
    await expectPublicationDenied(principal("cms.create"), published, draft);
    await expectPublicationAllowed(principal("cms.create", "cms.publish"), published, draft);
  });

  it("allows cms.edit draft updates and requires cms.publish for draft to published", async () => {
    expect(access.update({ req: request(principal("cms.edit")) })).toBe(true);
    await expectPublicationDenied(principal("cms.edit"), published, draft);
    await expectPublicationAllowed(principal("cms.edit", "cms.publish"), published, draft);
  });

  it("requires edit and publish for published modification and published to draft", async () => {
    expect(access.update({ req: request(principal("cms.publish")) })).toBe(false);
    await expectPublicationDenied(principal("cms.edit"), published, published);
    await expectPublicationAllowed(principal("cms.edit", "cms.publish"), published, published);
    expect(access.update({ req: request(principal("cms.edit")) })).toBe(true);
    await expectPublicationAllowed(principal("cms.publish"), draft, published);
    await expectPublicationDenied(principal("cms.edit"), draft, published);
    await expectPublicationAllowed(principal("cms.edit", "cms.publish"), draft, published);
  });

  it("allows superadmin.all and denies unauthenticated or malformed projections", async () => {
    expect(access.read({ req: request(principal("superadmin.all")) })).toBe(true);
    expect(access.create({ req: request(principal("superadmin.all")) })).toBe(true);
    expect(access.update({ req: request(principal("superadmin.all")) })).toBe(true);
    expect(access.read({ req: request() })).toBe(false);
    expect(access.create({ req: request({ capabilitySnapshot: ["cms.create", 7] }) })).toBe(false);
    expect(access.update({ req: request({ capabilitySnapshot: "cms.edit" }) })).toBe(false);
  });
});
