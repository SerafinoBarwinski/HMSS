# Jellyfin API Compatibility Notes

## Mandatory UUIDs

Jellyfin clients (Mobile, Web, etc.) strictly require UUID-formatted identifiers. Integer-based IDs will be rejected.

| Field | Format | Example |
|---|---|---|
| User `Id` | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | `a9e2ec81-f9fb-419d-a0c0-f782ae618a20` |
| Server `Id` | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | `ef71ba80-3b5d-48c9-a175-5fad144fe7bb` |

These are generated server-side and are not user-selectable. The internal DB uses auto-increment integers as primary keys; UUIDs are mapped via a separate column for API exposure.

## Known Client Quirks

- **ProductName** must be `"Jellyfin Server"` — any other value triggers "unsupported product" error. WHY?
- **Version** in `/System/Info/Public` must match the Jellyfin API version format (`x.x.x`).
- **LoginAttemptsBeforeLockout** must be `-1`, not `0`.
- **AuthenticationProviderId** must be `"Jellyfin.Server.Implementations.Users.DefaultAuthenticationProvider"`.
