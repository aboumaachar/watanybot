import {
  findFreelancerSkills,
  getApprovedFreelancerSkills,
  isValidFreelancerSkillSelection,
  makeCustomFreelancerSkillSuggestion,
} from "./civilian-jobs.skill-registry";

describe("civilian jobs freelancer skill registry", () => {
  it("contains Lebanese market core skills", () => {
    const labels = getApprovedFreelancerSkills().map((skill) => skill.arabicName);
    expect(labels).toEqual(expect.arrayContaining(["نجار", "كهربجي", "سنكري", "دهان", "سائق"]));
  });

  it("supports search aliases", () => {
    expect(findFreelancerSkills("كهربائي").some((skill) => skill.skillId === "CON_ELEC_001")).toBe(true);
    expect(findFreelancerSkills("سباك").some((skill) => skill.skillId === "CON_PLUMB_001")).toBe(true);
  });

  it("validates multi-skill selections", () => {
    expect(isValidFreelancerSkillSelection(["CON_ELEC_001", "TRN_DRV_001"])).toBe(true);
    expect(isValidFreelancerSkillSelection(["UNKNOWN_SKILL"])).toBe(false);
  });

  it("creates pending custom suggestions for admin review", () => {
    const suggestion = makeCustomFreelancerSkillSuggestion({ rawLabel: "فني كاميرات" });
    expect(suggestion.status).toBe("pending_review");
    expect(suggestion.normalizedLabel).toContain("فني");
  });
});