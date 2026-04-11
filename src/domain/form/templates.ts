import type { FormFieldInput } from "./validation";
import { DEFAULT_THEME, type FormThemeInput } from "./theme";

/**
 * Eight starter templates covering the most common lead-capture
 * intents for the small-business market FormTrack targets. Each
 * template is a pure data object validated by the same schemas as
 * any user-authored form, so anything valid here is valid through
 * the whole stack.
 *
 * Ordering matters: the order below is the order they render in the
 * gallery.
 */

export type TemplateKey =
  | "contact"
  | "consultation"
  | "quote"
  | "newsletter"
  | "booking"
  | "feedback"
  | "rsvp"
  | "waitlist";

export interface FormTemplate {
  readonly key: TemplateKey;
  readonly title: string;
  readonly blurb: string;
  readonly badge: string;
  readonly defaultFormTitle: string;
  readonly theme: FormThemeInput;
  readonly fields: readonly FormFieldInput[];
  readonly submitButtonLabel: string;
  readonly successMessage: string;
}

function field(
  i: number,
  overrides: Omit<FormFieldInput, "displayOrder" | "stepIndex"> &
    Partial<Pick<FormFieldInput, "stepIndex">>,
): FormFieldInput {
  return {
    stepIndex: 0,
    displayOrder: i,
    ...overrides,
  };
}

export const FORM_TEMPLATES: readonly FormTemplate[] = [
  {
    key: "contact",
    title: "Contact form",
    blurb:
      "The classic get-in-touch form. Four fields, low friction, high completion rate.",
    badge: "Most popular",
    defaultFormTitle: "Get in touch",
    theme: DEFAULT_THEME,
    submitButtonLabel: "Send message",
    successMessage:
      "Thanks for reaching out — we'll get back to you within one business day.",
    fields: [
      field(0, {
        type: "short_text",
        label: "Full name",
        placeholder: "Jane Doe",
        required: true,
      }),
      field(1, {
        type: "email",
        label: "Email",
        placeholder: "jane@company.com",
        required: true,
      }),
      field(2, {
        type: "phone",
        label: "Phone",
        placeholder: "(555) 123-4567",
        required: false,
      }),
      field(3, {
        type: "long_text",
        label: "How can we help?",
        placeholder: "Tell us a little about what you're looking for…",
        required: true,
      }),
    ],
  },
  {
    key: "consultation",
    title: "Free consultation",
    blurb:
      "A pre-call questionnaire that filters unqualified leads before they hit your calendar.",
    badge: "Service businesses",
    defaultFormTitle: "Book a free consultation",
    theme: { ...DEFAULT_THEME, accent: "#6EE7A0" },
    submitButtonLabel: "Request my consultation",
    successMessage:
      "Got it. We'll email you two time slots in the next hour — watch your inbox.",
    fields: [
      field(0, {
        type: "short_text",
        label: "Full name",
        required: true,
      }),
      field(1, {
        type: "email",
        label: "Work email",
        required: true,
      }),
      field(2, {
        type: "phone",
        label: "Best number to reach you",
        required: true,
      }),
      field(3, {
        type: "dropdown",
        label: "What are you hoping to get out of this call?",
        required: true,
        options: [
          "I'm exploring my options",
          "I have a specific project",
          "I need help urgently",
          "Just curious",
        ],
      }),
      field(4, {
        type: "dropdown",
        label: "Approximate budget",
        required: true,
        options: [
          "Under $1,000",
          "$1,000 – $5,000",
          "$5,000 – $25,000",
          "$25,000 – $100,000",
          "$100,000+",
        ],
      }),
    ],
  },
  {
    key: "quote",
    title: "Request a quote",
    blurb:
      "A longer-form intake built for custom work — home services, consulting, and agencies.",
    badge: "High-intent",
    defaultFormTitle: "Request a quote",
    theme: { ...DEFAULT_THEME, accent: "#F4C261" },
    submitButtonLabel: "Get my quote",
    successMessage:
      "We'll review the details and send a written quote within 48 hours.",
    fields: [
      field(0, { type: "short_text", label: "Full name", required: true }),
      field(1, { type: "email", label: "Email", required: true }),
      field(2, { type: "phone", label: "Phone", required: true }),
      field(3, {
        type: "short_text",
        label: "Company",
        required: false,
      }),
      field(4, {
        type: "dropdown",
        label: "Project type",
        required: true,
        options: [
          "New build",
          "Renovation",
          "Repair",
          "Consultation only",
          "Something else",
        ],
      }),
      field(5, {
        type: "long_text",
        label: "Describe the project",
        placeholder: "Rough scope, square footage, timeline, anything relevant",
        required: true,
      }),
      field(6, {
        type: "date",
        label: "Ideal start date",
        required: false,
      }),
    ],
  },
  {
    key: "newsletter",
    title: "Newsletter signup",
    blurb:
      "One-field email capture with optional name. Use on blogs, footers, and exit intents.",
    badge: "Content",
    defaultFormTitle: "Join the newsletter",
    theme: { ...DEFAULT_THEME, corners: "pill" },
    submitButtonLabel: "Subscribe",
    successMessage: "You're in. First issue drops Tuesday.",
    fields: [
      field(0, {
        type: "email",
        label: "Your email",
        placeholder: "you@company.com",
        required: true,
      }),
      field(1, {
        type: "short_text",
        label: "First name (optional)",
        required: false,
      }),
    ],
  },
  {
    key: "booking",
    title: "Appointment booking",
    blurb:
      "Captures intent for a service booking. Pair with your calendar in step 10.",
    badge: "Appointments",
    defaultFormTitle: "Book an appointment",
    theme: DEFAULT_THEME,
    submitButtonLabel: "Request appointment",
    successMessage:
      "Thanks! We'll confirm your time slot by email within an hour.",
    fields: [
      field(0, { type: "short_text", label: "Full name", required: true }),
      field(1, { type: "email", label: "Email", required: true }),
      field(2, { type: "phone", label: "Phone", required: true }),
      field(3, {
        type: "dropdown",
        label: "Service",
        required: true,
        options: [
          "Initial consultation",
          "Follow-up",
          "Check-in",
          "Other",
        ],
      }),
      field(4, {
        type: "date",
        label: "Preferred date",
        required: true,
      }),
      field(5, {
        type: "long_text",
        label: "Anything we should know?",
        required: false,
      }),
    ],
  },
  {
    key: "feedback",
    title: "Customer feedback",
    blurb:
      "Post-purchase or post-service feedback with a rating and open comment field.",
    badge: "Retention",
    defaultFormTitle: "How'd we do?",
    theme: { ...DEFAULT_THEME, accent: "#FF7A93" },
    submitButtonLabel: "Send feedback",
    successMessage: "Appreciate you taking the time. Every word gets read.",
    fields: [
      field(0, {
        type: "radio",
        label: "How would you rate your experience?",
        required: true,
        options: ["⭐ Terrible", "⭐⭐ Poor", "⭐⭐⭐ OK", "⭐⭐⭐⭐ Great", "⭐⭐⭐⭐⭐ Amazing"],
      }),
      field(1, {
        type: "long_text",
        label: "What stood out?",
        placeholder: "Good, bad, or in between — tell us everything.",
        required: true,
      }),
      field(2, {
        type: "email",
        label: "Email (if you'd like us to follow up)",
        required: false,
      }),
    ],
  },
  {
    key: "rsvp",
    title: "Event RSVP",
    blurb:
      "Collect head counts and dietary requirements for events, workshops, and launches.",
    badge: "Events",
    defaultFormTitle: "RSVP",
    theme: DEFAULT_THEME,
    submitButtonLabel: "Confirm RSVP",
    successMessage:
      "See you there. We'll send a calendar invite + venue details shortly.",
    fields: [
      field(0, { type: "short_text", label: "Full name", required: true }),
      field(1, { type: "email", label: "Email", required: true }),
      field(2, {
        type: "radio",
        label: "Will you be attending?",
        required: true,
        options: ["Yes, I'll be there", "No, can't make it", "Maybe"],
      }),
      field(3, {
        type: "number",
        label: "How many guests are you bringing?",
        required: true,
      }),
      field(4, {
        type: "checkbox",
        label: "Any dietary requirements?",
        required: false,
        options: [
          "Vegetarian",
          "Vegan",
          "Gluten-free",
          "Nut allergy",
          "Dairy-free",
        ],
      }),
    ],
  },
  {
    key: "waitlist",
    title: "Product waitlist",
    blurb:
      "Minimal-friction waitlist for product launches. Email + one qualification question.",
    badge: "Launches",
    defaultFormTitle: "Join the waitlist",
    theme: { ...DEFAULT_THEME, corners: "pill" },
    submitButtonLabel: "Join the waitlist",
    successMessage:
      "You're on the list. We'll email you the moment early access opens.",
    fields: [
      field(0, {
        type: "email",
        label: "Email",
        placeholder: "you@company.com",
        required: true,
      }),
      field(1, {
        type: "dropdown",
        label: "What describes you best?",
        required: true,
        options: [
          "Solo founder",
          "Small team (2-10)",
          "Growing startup (11-50)",
          "Established company (50+)",
          "Enterprise",
        ],
      }),
    ],
  },
] as const;

export function getTemplate(key: TemplateKey): FormTemplate {
  const t = FORM_TEMPLATES.find((x) => x.key === key);
  if (!t) throw new Error(`Unknown template: ${key}`);
  return t;
}
