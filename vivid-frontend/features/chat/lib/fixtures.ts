import type { Session } from "@/features/chat/lib/types";

// Placeholder thread content.
//
// There is no chat endpoint in vivid-backend yet, and a thread screen cannot
// be built or reviewed without something in it. This is the only invented data
// in the slice, it is confined to this file, and `useSession` reads it through
// the same shape a real query will return, so switching to the live endpoint is
// a change to that hook alone.
export const SAMPLE_SESSIONS: Session[] = [
  {
    id: "glass-refraction",
    title: "How does glass refract light?",
    updatedAt: "2026-08-23T09:12:00.000Z",
    messages: [
      {
        id: "m1",
        role: "user",
        content: "How does glass refract light?",
      },
      {
        id: "m2",
        role: "assistant",
        content:
          "Light bends when it crosses from one medium into another because its speed changes. In a vacuum light travels at roughly 300,000 km/s; in common soda-lime glass it slows to about 200,000 km/s. That ratio is the refractive index, around 1.5 for window glass.\n\nWhen a ray meets the surface at an angle, the side of the wavefront that enters first slows first, so the wavefront pivots. The relationship between the incoming and outgoing angles is Snell's law: n₁ sin θ₁ = n₂ sin θ₂.\n\nBecause the refractive index varies slightly with wavelength, blue light bends a little more than red. That spread is dispersion, and it is why a prism separates white light into colours.",
        sources: [
          {
            id: "s1",
            title: "Refraction of light",
            domain: "science.org.au",
            url: "https://www.science.org.au",
            snippet:
              "Refraction is the bending of light as it passes from one transparent substance into another.",
          },
          {
            id: "s2",
            title: "Snell's law and the refractive index",
            domain: "britannica.com",
            url: "https://www.britannica.com",
            snippet:
              "The ratio of the sines of the angles of incidence and refraction is constant for a given pair of media.",
          },
          {
            id: "s3",
            title: "Dispersion and prisms",
            domain: "physicsclassroom.com",
            url: "https://www.physicsclassroom.com",
            snippet:
              "Different wavelengths refract by different amounts, separating white light into its components.",
          },
        ],
      },
    ],
  },
];

export function findSession(id: string): Session | undefined {
  return SAMPLE_SESSIONS.find((session) => session.id === id);
}
