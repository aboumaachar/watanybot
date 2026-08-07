# Plugin Settings Dashboard Contract

Every plugin must be manageable from admin/superadmin settings without hard-coding Watany-specific behavior inside the plugin core.

## Required Admin Controls

- Enable or disable the plugin
- Enable or disable child features
- Configure display order, labels, and icon key
- Configure permissions and role visibility
- Configure data source
- Validate settings before save

## Handoff

This contract prepares the host for a future admin UI that manages plugin behavior.
