import { describe, it, expect } from "vitest";
import { formatNaira, unitPriceFor, lineTotals } from "@/lib/pricing";

describe("pricing", () => {
  it("formats naira", () => expect(formatNaira(25000)).toBe("₦25,000"));
  it("no discount under 10 units", () => expect(unitPriceFor(10000, 9)).toBe(10000));
  it("5% off at 10+ units", () => expect(unitPriceFor(10000, 10)).toBe(9500));
  it("10% off at 25+ units", () => expect(unitPriceFor(10000, 25)).toBe(9000));
  it("line discount", () => expect(lineTotals(10000, 25).discount).toBe(25000));
});
