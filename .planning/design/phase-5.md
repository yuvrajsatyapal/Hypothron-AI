# Phase 5 data workspace design

Use the existing foundation paper/surface/ink/muted/accent/link/border tokens and native labels, buttons, details and tables. Retain single-column narrow layout and locally scrolling code/tables. No new branding or screen framework.

File controls accept CSV and Parquet. Preserve existing CSV label for compatibility, with adjacent Parquet support explanation. Profile feedback shows local column names/types, row count, immutable original SHA256 and derived CSV SHA256. Parquet requires explicit approval of the displayed canonical dataset version before computation. Explain that DuckDB decodes Parquet once; DuckDB/Pandas independently perform arithmetic over that canonical snapshot. Unsupported types/ambiguous timestamps fail with an accessible status and no silent conversion. Cancellation terminates conversion just like calculation.

Lookup approval remains separate. Additional independent sources share displayed metric semantics but omit the primary's lookup relationship. Three total distinct source identities includes the lookup. Changing additional selection revokes provider/metric consent; changing primary source revokes derived-version and lookup approvals. Historical artifacts retain labels/versions and original bytes. Save/export disclosure includes original Parquet and derived CSV. Playback remains explicitly historical CLIENT_REPORTED.

Acceptance: actual Parquet import/profile/version approval/calculation/save/reload/export/import/replay; negative formats/types/limits; original v1 CSV paths; three-source graph/capture; keyboard labelled controls, status live region and narrow overflow.
