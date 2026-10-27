import { expect, it } from "vitest";
import { completeScalar, scalarIssues } from "./scalars.js";
it("retains incomplete scalar text and rejects nonfinite/range-invalid values without numeric coercion", () => {
  for (const text of ["-", "1e", "", "Infinity", "NaN"])
    expect(completeScalar({ text, optional: false })).toBe(false);
  for (const text of ["0", "201", "1.5"])
    expect(
      completeScalar({
        text,
        optional: false,
        min: 1,
        max: 200,
        integer: true,
      }),
    ).toBe(false);
  expect(completeScalar({ text: "0", optional: true, positive: true })).toBe(
    false,
  );
  expect(completeScalar({ text: "", optional: true })).toBe(true);
  expect(
    completeScalar({
      text: "1e2",
      optional: false,
      min: 1,
      max: 200,
      integer: true,
    }),
  ).toBe(true);
  expect(
    scalarIssues({
      "object:Width": { text: "-", optional: true, positive: true },
    }),
  ).toMatchObject([{ objectId: "object", field: "Width" }]);
});
