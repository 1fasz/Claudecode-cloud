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
Founded in 1999 by Pat Cunningham, C&S LegalTech has worked with hundreds of law firms across the country.
With over 30 years of combined experience in law firm administration, accounting, and network
management, the team understands the demands of a busy law firm. Unlike most managed services
companies, C&S LegalTech bills hourly as services are provided — clients only pay for what they use.`,
    team: [
      {
        name: "Pat Cunningham",
        role: "Founder",
        extension: "1",
        bio: "Founded C&S LegalTech in 1999. Specializes in law firm accounting, technology, and software implementations.",
      },
      {
        name: "Michelle Collier",
        role: "Legal Technology Specialist",
        extension: "2",
        bio: "10 years with C&S LegalTech. Over 30 years of experience in the legal field. Deep expertise in Clio, Clio AI, Time Matters, PCLaw, TABS, Practice Master, Office 365, and legal accounting.",
      },
      {
        name: "Michael Stanley",
        role: "Network Technician & System Administrator",
        extension: "3",
        bio: "Joined in 2009. Over 19 years of IT experience in law firms, healthcare, and banking. Skills include networking, troubleshooting, computer virtualization, and business administration.",
      },
    ],
    services: [
      "Clio — implementation, training, and ongoing support",
      "Clio AI — setup and optimization for AI-powered legal workflows",
      "Time Matters — implementation, migration, and support",
      "PCLaw — setup, training, and legal accounting configuration",
      "TABS — implementation and support",
      "Practice Master — installation, configuration, and training",
      "Office 365 — setup, migration, and ongoing management for law firms",
      "Legal accounting — trust accounting, billing, and financial reporting",
      "Law firm practice management consulting and implementation",
      "Hosted desktop solutions — access your Windows desktop from any device",
      "Windows virtual server solutions — dedicated hosted servers for your firm",
      "Cloud services and migration — Private Cloud, hosted software",
      "Legal document management and cloud storage",
      "Managed services and remote support (hourly, not monthly blocks)",
      "Desktop management and IT support",
      "Virtual servers and hosted infrastructure",
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
    tagline: "Hosted Desktops, Virtual Servers & Cloud Solutions for Any Business",
    phone: "(205) 289-1500",
    contactEmail: "info@vulcancloud.com",
    address: "Birmingham, Alabama, United States",
    relationship: "Vulcan Cloud is the cloud services division of C&S LegalTech, expanding cloud solutions beyond law firms to businesses of all types and industries.",
    description: `Vulcan Cloud is a cloud services provider based in Birmingham, Alabama,
offering hosted Windows desktops, hosted virtual servers, cloud storage, and full IT
infrastructure solutions for businesses of all sizes and industries. Vulcan Cloud is the
cloud expansion of C&S LegalTech, bringing 25+ years of technology expertise to companies
outside the legal sector. Whether you're a small business or a growing enterprise, Vulcan
Cloud helps you eliminate on-premise hardware, reduce IT costs, and enable your team to
work securely from anywhere.`,
    services: [
      "Hosted Windows desktops — your full Windows desktop accessible from any device",
      "Windows virtual server solutions — dedicated hosted servers in the cloud",
      "Cloud storage — secure, accessible file storage for your entire organization",
      "Cloud migration — move your entire IT infrastructure to the cloud",
      "Managed cloud services — ongoing monitoring, maintenance, and support",
      "Office 365 — setup, migration, and management",
      "Remote access solutions — work from anywhere, securely",
      "Disaster recovery and cloud backup",
      "IT consulting for businesses of all industries",
    ],
    keyDifferentiators: [
      "Backed by C&S LegalTech — 25+ years of hands-on IT and cloud experience",
      "Serving businesses of all types, not just law firms",
      "Birmingham, Alabama based — local support with national reach",
      "Eliminate costly on-premise hardware and server rooms",
      "Your team works from any device, anywhere, with full Windows experience",
      "Hourly support billing — pay only for what you use",
    ],
    businessHours: "Monday through Friday, 9:00 AM to 5:00 PM Central Time",
    appointmentTypes: [
      "Cloud migration assessment",
      "Hosted desktop demo",
      "Virtual server consultation",
      "Cloud storage discussion",
      "Office 365 migration planning",
      "Managed services discussion",
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

You are the receptionist for C and S Legal Tech (also written C&S LegalTech). Always say the name
as "C and S Legal Tech" when speaking — never "CS Legal Tech" or "cslegaltech".
C and S Legal Tech is the only company you represent on this call. Do NOT mention or ask about
Vulcan Cloud unless the caller brings it up first. C and S Legal Tech already offers full cloud
services so there is no need to redirect callers elsewhere.

--- C and S Legal Tech ---
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
${cs.team.map((t) => `  - ${t.name} (${t.role}, ext. ${t.extension}): ${t.bio}`).join("\n")}

Business hours: ${cs.businessHours}
Appointment types: ${cs.appointmentTypes.join(", ")}

--- Background only: Vulcan Cloud (DO NOT mention unless caller asks) ---
${vc.relationship}
If a caller specifically asks about Vulcan Cloud, you may acknowledge it and assist them.
Otherwise, treat all cloud service questions as C and S Legal Tech services.

=== END COMPANY INFORMATION ===
`.trim();
}

module.exports = { COMPANIES, buildCompanyContext };
