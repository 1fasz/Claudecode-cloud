/**
 * Company Knowledge Base
 * Real data for C&S LegalTech Consulting Group LLC and Vulcan Cloud.
 * This is injected into the AI system prompt for every call.
 */

const COMPANIES = {
  cslegaltech: {
    name: "C&S LegalTech Consulting Group",
    website: "https://cslegaltech.com",
    tagline: "Legal Technology Consulting Since 1999",
    phone: "(205) 289-1500",
    contactEmail: "info@cslegaltech.com",
    address: "Alabama, United States",
    founded: "1999",
    description: `C&S LegalTech Consulting Group LLC is a full-service technology and consulting
company specializing in law firm practice management, accounting systems, and cloud services.
Founded in 1999 by Pat, C&S LegalTech has worked with hundreds of law firms across the country.
With over 30 years of combined experience in law firm administration, accounting, and network
management, the team understands the demands of a busy law firm. Unlike most managed services
companies, C&S LegalTech bills hourly as services are provided — clients only pay for what they use.`,
    team: [
      {
        name: "Pat",
        role: "Founder",
        bio: "Founded C&S LegalTech in 1999. Specializes in law firm accounting, technology, and software implementations.",
      },
      {
        name: "Michael Stanley",
        role: "Network Technician & System Administrator",
        bio: "Joined in 2009. Over 19 years of IT experience in law firms, healthcare, and banking. Skills include networking, troubleshooting, computer virtualization, and business administration.",
      },
    ],
    services: [
      "Law firm practice management software consulting and implementation",
      "Legal accounting and billing software (multiple solutions available)",
      "Cloud services and migration — Private Cloud, hosted software, Office 365",
      "Legal document management and cloud storage",
      "Managed services and remote support (hourly, not monthly blocks)",
      "Desktop management and IT support",
      "Virtual servers and hosted infrastructure",
      "Legal billing and time tracking solutions",
      "Case management and CRM consulting",
      "Network administration and troubleshooting",
      "System upgrades and after-hours installations to minimize downtime",
    ],
    keyDifferentiators: [
      "In business since 1999 — over 25 years serving law firms",
      "Hourly billing only — you pay for what you use, no monthly retainers forced",
      "Installations and upgrades performed evenings and weekends to minimize firm downtime",
      "Hundreds of active clients across the country, most are long-term",
      "Deep law firm expertise: accounting, administration, and IT under one roof",
    ],
    businessHours: "Monday through Friday, 9:00 AM to 5:00 PM Central Time",
    appointmentTypes: [
      "Technology consultation",
      "Practice management software demo",
      "Cloud migration assessment",
      "Legal accounting software review",
      "Managed services discussion",
      "Remote support session",
      "Network assessment",
    ],
  },

  vulcancloud: {
    name: "Vulcan Cloud",
    website: "https://vulcancloud.com",
    tagline: "Hosted Virtual Desktops, Servers & Cloud Storage",
    phone: null,
    contactEmail: "info@vulcancloud.com",
    address: "Birmingham, Alabama, United States",
    description: `Vulcan Cloud is a cloud services provider based in Birmingham, Alabama,
offering hosted virtual desktops, hosted virtual servers, and cloud storage solutions.
Vulcan Cloud helps organizations rapidly migrate their IT infrastructure to the cloud,
enabling businesses to reduce on-premise hardware costs and work from anywhere.`,
    services: [
      "Hosted virtual desktops (work from any device, anywhere)",
      "Hosted virtual servers",
      "Cloud storage solutions",
      "Cloud migration services",
      "IT infrastructure migration to the cloud",
    ],
    keyDifferentiators: [
      "Based in Birmingham, Alabama — local expertise",
      "Rapid cloud migration for businesses of all sizes",
      "Reduce on-premise hardware costs",
      "Enable remote work from any device",
    ],
    businessHours: "Monday through Friday, 9:00 AM to 5:00 PM Central Time",
    appointmentTypes: [
      "Cloud migration assessment",
      "Virtual desktop demo",
      "Hosted server consultation",
      "Cloud storage discussion",
      "General cloud inquiry",
    ],
  },
};

/**
 * Build the company context string injected into the AI system prompt.
 */
function buildCompanyContext() {
  const cs = COMPANIES.cslegaltech;
  const vc = COMPANIES.vulcancloud;

  return `
=== COMPANY INFORMATION ===

You represent two related companies. When a caller asks about a specific company, focus on that one.
If it's unclear which company they're calling about, ask them.

--- Company 1: ${cs.name} ---
Website: ${cs.website}
Phone: ${cs.phone}
Email: ${cs.contactEmail}
Location: ${cs.address}
Founded: ${cs.founded}
Tagline: ${cs.tagline}

About: ${cs.description.trim()}

Services:
${cs.services.map((s) => `  - ${s}`).join("\n")}

Why clients choose us:
${cs.keyDifferentiators.map((d) => `  - ${d}`).join("\n")}

Team:
${cs.team.map((t) => `  - ${t.name} (${t.role}): ${t.bio}`).join("\n")}

Business hours: ${cs.businessHours}
Appointment types: ${cs.appointmentTypes.join(", ")}

--- Company 2: ${vc.name} ---
Website: ${vc.website}
Email: ${vc.contactEmail}
Location: ${vc.address}
Tagline: ${vc.tagline}

About: ${vc.description.trim()}

Services:
${vc.services.map((s) => `  - ${s}`).join("\n")}

Why clients choose us:
${vc.keyDifferentiators.map((d) => `  - ${d}`).join("\n")}

Business hours: ${vc.businessHours}
Appointment types: ${vc.appointmentTypes.join(", ")}

=== END COMPANY INFORMATION ===
`.trim();
}

module.exports = { COMPANIES, buildCompanyContext };
