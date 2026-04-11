import { describe, expect, it } from "vitest";
import { resolveAttribution } from "@/domain/lead/attribution";

describe("resolveAttribution", () => {
  it("treats a Meta UTM trail as high-confidence Meta Ads", () => {
    const result = resolveAttribution({
      utmSource: "facebook",
      utmMedium: "cpc",
      utmCampaign: "spring-sale-23",
      fbclid: "abc123",
      pageUrl: "https://acme.com/contact",
      referrer: "https://l.instagram.com/",
    });

    expect(result.channel).toBe("meta_ads");
    expect(result.confidence).toBe("high");
    expect(result.campaign).toBe("spring-sale-23");
    expect(result.explanation).toContain("Meta Ads");
    expect(result.explanation).toContain("spring-sale-23");
  });

  it("treats a Google Ads UTM as high-confidence Google Ads", () => {
    const result = resolveAttribution({
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "brand-search",
      gclid: "xyz789",
      pageUrl: "https://acme.com/",
    });

    expect(result.channel).toBe("google_ads");
    expect(result.confidence).toBe("high");
    expect(result.campaign).toBe("brand-search");
  });

  it("falls back to medium confidence when only a fbclid is present", () => {
    const result = resolveAttribution({
      fbclid: "abc",
      pageUrl: "https://acme.com/",
    });

    expect(result.channel).toBe("meta_ads");
    expect(result.confidence).toBe("medium");
    expect(result.campaign).toBeNull();
  });

  it("detects Google organic from referrer host alone", () => {
    const result = resolveAttribution({
      referrer: "https://www.google.com/search?q=acme",
      pageUrl: "https://acme.com/",
    });

    expect(result.channel).toBe("google_organic");
    expect(result.confidence).toBe("medium");
    expect(result.referrerHost).toContain("google");
  });

  it("returns low-confidence direct when nothing is present", () => {
    const result = resolveAttribution({
      pageUrl: "https://acme.com/",
    });

    expect(result.channel).toBe("direct");
    expect(result.confidence).toBe("low");
    expect(result.label).toBe("Direct / Untracked");
  });

  it("handles a malformed referrer without crashing", () => {
    const result = resolveAttribution({
      referrer: "not a url at all",
      pageUrl: "https://acme.com/",
    });

    expect(result.channel).toBe("direct");
    expect(result.referrerHost).toBeNull();
  });

  it("email newsletter UTMs are classified as email", () => {
    const result = resolveAttribution({
      utmSource: "newsletter",
      utmMedium: "email",
      utmCampaign: "april-promo",
      pageUrl: "https://acme.com/",
    });

    expect(result.channel).toBe("email");
    expect(result.campaign).toBe("april-promo");
    expect(result.confidence).toBe("high");
  });
});
