---
name: maps
description: How to use Google Maps (Places autocomplete, a map, distance) in an app the builder makes. Applies when the project has a Google Maps key.
---

# Maps with Google

`VITE_GOOGLE_MAPS_KEY` is set in .env: a browser key with the Maps JavaScript, Places
and Geocoding APIs enabled. It ships inside the app, so tell the user in the final reply
to restrict it to their site's domain in Google Cloud (Credentials, HTTP referrers).

## Loading
One hook, `useGoogleMaps()` in `src/lib/maps.ts`, injects
`https://maps.googleapis.com/maps/api/js?key=...&libraries=places&loading=async&v=weekly`
once and resolves when `window.google.maps` exists. Never load it twice; never load it on
pages that do not need it. Types: `npm install -D @types/google.maps`.

## Address fields (Places autocomplete)
Every address input (delivery address, pickup, business address) is a
`PlaceAutocomplete` component: a normal `Input` wired to
`new google.maps.places.Autocomplete(input, { componentRestrictions: { country: "ng" },
fields: ["formatted_address", "geometry", "address_components"] })`. On `place_changed`
store `formatted_address`, `lat`, `lng` and the area (the `sublocality` or `locality`
component) on the address row. The field still accepts typed text when the user ignores
the suggestions; lat and lng are then null and the zone is asked for explicitly.
Bias results to the spec's city with `bounds`.

## Zones, fees and ETA by distance
With lat and lng on both ends, compute distance client-side with the haversine formula
(no Distance Matrix call, no server) in `src/lib/geo.ts`: `distanceKm(a, b)`. Fee and ETA
come from the spec's zone table keyed by area, with distance as the fallback when the area
is unknown ("N1,200 within 8 km, N2,000 beyond"). Show the computed fee before payment.

## Maps on screen
- Tracking page: a `Map` component (a `div` with `ref`, `new google.maps.Map(el, { center,
  zoom: 13, disableDefaultUI: true })`) with markers for pickup and drop-off and, when the
  row has `rider_lat`/`rider_lng`, the rider. Realtime updates move the rider marker.
- Store locator or branches: one map with a marker per branch and a list beside it.
- Admin: a small map in the order drawer, nothing more.
Maps are `aspect-video` on phones and fill their column on desktop; always with a
loading skeleton and a plain-text fallback (the address) when the script fails.

## Without a key
If `VITE_GOOGLE_MAPS_KEY` is empty, every map area shows the address as text and address
inputs are plain inputs; nothing breaks.
