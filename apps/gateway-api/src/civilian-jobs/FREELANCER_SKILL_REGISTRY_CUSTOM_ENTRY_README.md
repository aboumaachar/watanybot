# Civilian Jobs Freelancer Skill Registry + Custom Entry

This Wave12-focused patch expands the controlled freelancer skill registry for the Lebanese market and adds a safe custom-entry workflow.

## Product Boundary

- This belongs only to Civilian Jobs & Services / فرص العمل المدنية والخدمات.
- It must not modify or couple with إعلانات التطويع.

## Implemented Concepts

1. Controlled multi-skill registry for search and matching.
2. Lebanese market skills across construction, maintenance, transport, security, digital, IT, education, health support, agriculture, office services, volunteer work, and small business services.
3. Custom user-submitted skill suggestions.
4. Pending admin review before new custom skills are promoted into the approved registry.

## Important Next Hardening

- Persist custom skill suggestions in the repository/database.
- Add admin UI for approve/reject/promote-to-registry.
- Add analytics for frequently requested custom skills.
- Keep skill IDs stable once used for matching.